"""One small door to whichever LLM is configured: Groq (hosted), Ollama (local) or none.

All supported providers accept the same OpenAI-style "chat completions" request, so this module
needs no SDK. It adds:
  - a cache (outputs/llm_cache.json): the same request never runs twice, so a demo replays
    instantly and offline once a batch has run
  - pacing under the provider's free-tier rate limit, and retries on 429 / 5xx
  - a hard "no" when the provider is `none` or misconfigured: callers then use the engine's
    own pick or a template, and nothing fails

Settings come from .env at call time:
  JC_LLM_PROVIDER   none | groq | ollama        (default none)
  JC_LLM_MODEL      override the provider's default model
  GROQ_API_KEY      for groq
"""
import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass

from dotenv import load_dotenv

from . import config

load_dotenv(config.ROOT / ".env")


class LLMUnavailable(Exception):
    """No provider configured, no key, or the provider could not be reached."""


@dataclass
class Provider:
    name: str
    url: str
    model: str
    key: str | None
    requests_per_minute: int
    local: bool


def provider() -> Provider | None:
    name = os.getenv("JC_LLM_PROVIDER", "none").strip().lower()
    if name in ("", "none"):
        return None
    if name not in config.LLM_PROVIDERS:
        raise LLMUnavailable(f"unknown JC_LLM_PROVIDER '{name}'")
    spec = config.LLM_PROVIDERS[name]
    key = os.getenv(spec["key_env"]) if spec["key_env"] else None
    if spec["key_env"] and not key:
        raise LLMUnavailable(f"{spec['key_env']} is not set in .env")
    return Provider(name, spec["url"], os.getenv("JC_LLM_MODEL") or spec["model"], key,
                    spec["requests_per_minute"], spec["local"])


def notes_allowed(p: Provider | None) -> bool:
    """May volunteer notes be sent to this provider? See config.NOTES_TO_HOSTED_LLM_DATASETS."""
    if p is None:
        return False
    return p.local or config.DATASET in config.NOTES_TO_HOSTED_LLM_DATASETS or os.getenv("JC_LLM_NOTES") == "1"


# ---------------------------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------------------------
_cache: dict | None = None


def _load_cache() -> dict:
    global _cache
    if _cache is None:
        path = config.LLM_CACHE_FILE
        _cache = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    return _cache


def _save_cache() -> None:
    config.LLM_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    config.LLM_CACHE_FILE.write_text(json.dumps(_load_cache(), ensure_ascii=False, indent=0), encoding="utf-8")


def _key(p: Provider, body: dict) -> str:
    return hashlib.sha256(json.dumps([p.name, body], sort_keys=True, ensure_ascii=False).encode()).hexdigest()


# ---------------------------------------------------------------------------------------------
# Calling
# ---------------------------------------------------------------------------------------------
_last_call = 0.0


def _pace(p: Provider) -> None:
    global _last_call
    if p.requests_per_minute:
        wait = 60.0 / p.requests_per_minute - (time.time() - _last_call)
        if wait > 0:
            time.sleep(wait)
    _last_call = time.time()


def _post(p: Provider, body: dict) -> dict:
    headers = {"Content-Type": "application/json", "User-Agent": "journey-compass"}
    if p.key:
        headers["Authorization"] = f"Bearer {p.key}"
    req = urllib.request.Request(p.url, data=json.dumps(body).encode(), headers=headers)
    for attempt in range(config.LLM_RETRIES):
        _pace(p)
        try:
            with urllib.request.urlopen(req, timeout=config.LLM_TIMEOUT_SECONDS) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:300]
            wait = float(e.headers.get("retry-after") or 5 * (attempt + 1))
            # A daily allowance won't come back within a run: fall back to the engine now, not after
            # minutes of retrying.
            daily = "per day" in detail or wait > 60
            if e.code in (429, 500, 502, 503) and not daily and attempt < config.LLM_RETRIES - 1:
                time.sleep(wait)
                continue
            raise LLMUnavailable(f"{p.name} HTTP {e.code}: {detail}") from None
        except (urllib.error.URLError, TimeoutError) as e:
            raise LLMUnavailable(f"{p.name} unreachable: {e}") from None
    raise LLMUnavailable(f"{p.name}: gave up after {config.LLM_RETRIES} attempts")


def chat(system: str, user: str, as_json: bool = False, temperature: float = 0.2) -> tuple[str, dict]:
    """Return (text, info). info says which provider/model answered and whether it was cached.

    Raises LLMUnavailable when there is no usable provider; callers fall back to the engine.
    """
    p = provider()
    if p is None:
        raise LLMUnavailable("JC_LLM_PROVIDER is none")
    body = {"model": p.model, "temperature": temperature,
            "messages": [{"role": "system", "content": system + (" Reply with JSON only." if as_json else "")},
                         {"role": "user", "content": user}]}
    if as_json:
        body["response_format"] = {"type": "json_object"}
    if "gpt-oss" in p.model:
        body["reasoning_effort"] = "low"

    cache, key = _load_cache(), _key(p, body)
    if key in cache:
        return cache[key], {"provider": p.name, "model": p.model, "cached": True}
    # Added after the cache key, so the cap does not invalidate earlier answers.
    body["max_completion_tokens"] = config.LLM_MAX_OUTPUT_TOKENS
    out = _post(p, body)
    text = (out["choices"][0]["message"].get("content") or "").strip()
    cache[key] = text
    _save_cache()
    return text, {"provider": p.name, "model": p.model, "cached": False}
