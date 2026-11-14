"""Step 3a: the LLM chooser, tested with a fake LLM (no network, no key)."""
import json

import pandas as pd
import pytest

from journey_compass import chooser, config, llm
from journey_compass.catalogue import load_catalogue
from journey_compass.data_loader import load_dataset
from journey_compass.journey import build_profiles

HOSTED = llm.Provider("groq", "https://example.invalid", "fake-model", "k", 0, local=False)
LOCAL = llm.Provider("ollama", "http://localhost", "fake-local", None, 0, local=True)


@pytest.fixture(scope="module")
def world():
    ds = load_dataset(config.ROOT / "data" / "synthetic")
    profiles = build_profiles(ds).set_index("participant_id")
    return ds, load_catalogue(), profiles


def run(world, pid, monkeypatch, answer=None, provider=HOSTED, error=None):
    ds, cat, profiles = world
    seen = {}

    def fake_chat(system, user, as_json=False, temperature=0.2):
        seen["prompt"] = user
        if error:
            raise error
        return (answer(seen) if callable(answer) else answer), {"cached": False, "model": provider.model}

    monkeypatch.setattr(llm, "provider", lambda: provider)
    monkeypatch.setattr(llm, "chat", fake_chat)
    profile = profiles.loc[pid].to_dict() | {"participant_id": pid}
    choice, steps = chooser.choose(profile, cat, ds.as_of, ds.contacts[ds.contacts["participant_id"] == pid])
    return choice, steps, seen


def pick(offer_id, reason="because", angle="an easy way back"):
    return json.dumps({"offer_id": offer_id, "coordinator_reason": reason, "message_angle": angle})


def test_shortlist_has_top5_plus_best_of_each_kind(world):
    ds, cat, profiles = world
    steps = chooser.shortlist(profiles.loc["p_002"].to_dict(), cat, ds.as_of)
    assert len({s.offer_id for s in steps}) == len(steps)
    assert {"course", "retreat", "seva", "event", "reconnect"} <= {s.offer_type for s in steps}


def test_empty_answer_falls_back_to_the_engine(world, monkeypatch):
    choice, steps, _ = run(world, "p_002", monkeypatch, answer=lambda seen: None)
    assert choice.source == "engine" and choice.offer_id == steps[0].offer_id


def test_a_valid_pick_from_the_shortlist_is_used(world, monkeypatch):
    ds, cat, profiles = world
    steps = chooser.shortlist(profiles.loc["p_002"].to_dict(), cat, ds.as_of)
    retreat = next(s for s in steps if s.offer_type == "retreat")
    choice, _, _ = run(world, "p_002", monkeypatch, answer=pick(retreat.offer_id, "note: retreat with partner"))
    assert choice.source == "ai" and choice.offer_id == retreat.offer_id
    assert choice.engine_offer_id == steps[0].offer_id


def test_an_offer_not_on_the_shortlist_is_rejected(world, monkeypatch):
    choice, steps, _ = run(world, "p_001", monkeypatch, answer=pick("made_up_offer"))
    assert choice.source == "engine" and choice.offer_id == steps[0].offer_id
    assert "not on the shortlist" in choice.note


def test_malformed_answer_falls_back_to_the_engine(world, monkeypatch):
    choice, steps, _ = run(world, "p_001", monkeypatch, answer="Sure! I'd pick the kitchen seva.")
    assert choice.source == "engine" and "invalid answer" in choice.note


def test_provider_failure_falls_back_to_the_engine(world, monkeypatch):
    choice, steps, _ = run(world, "p_001", monkeypatch, error=llm.LLMUnavailable("groq HTTP 429"))
    assert choice.source == "engine" and "429" in choice.note


def test_no_provider_means_engine_pick(world, monkeypatch):
    choice, steps, _ = run(world, "p_001", monkeypatch, provider=None, answer=pick("x"))
    assert choice.source == "engine" and choice.note == "no LLM configured"


def test_do_not_contact_never_reaches_the_llm(world, monkeypatch):
    ds, cat, profiles = world
    dnc = profiles.index[profiles["do_not_contact"]][0]
    choice, steps, seen = run(world, dnc, monkeypatch, answer=pick("x"))
    assert choice.offer_id == "" and steps == [] and "prompt" not in seen


def test_notes_are_withheld_from_a_hosted_model_for_real_data(world, monkeypatch):
    monkeypatch.setattr(config, "DATASET", "raw")
    _, steps, seen = run(world, "p_003", monkeypatch, answer=lambda s: pick("seva_kitchen"))
    assert "Wants to serve more" not in seen["prompt"]
    assert "not shared with this model" in seen["prompt"]
    _, _, seen_local = run(world, "p_003", monkeypatch, provider=LOCAL, answer=lambda s: pick("seva_kitchen"))
    assert "Wants to serve more" in seen_local["prompt"]


def test_prompt_states_time_as_days_not_words(world, monkeypatch):
    _, _, seen = run(world, "p_001", monkeypatch, answer=pick("seva_kitchen"))
    assert "174 days ago" in seen["prompt"] and "recently" not in seen["prompt"].lower()


def test_cache_means_the_same_request_runs_once(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "LLM_CACHE_FILE", tmp_path / "cache.json")
    monkeypatch.setattr(llm, "_cache", None)
    monkeypatch.setattr(llm, "provider", lambda: HOSTED)
    calls = []
    monkeypatch.setattr(llm, "_post", lambda p, body: calls.append(1) or {"choices": [{"message": {"content": "hi"}}]})
    first = llm.chat("sys", "user")
    second = llm.chat("sys", "user")
    assert len(calls) == 1 and first[0] == second[0] == "hi" and second[1]["cached"]
