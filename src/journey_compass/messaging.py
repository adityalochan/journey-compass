"""Draft a personalized message with Claude; fall back to a template if no API key or a failure."""
import os

import anthropic
from dotenv import load_dotenv

from . import config
from .recommender import NextStep

load_dotenv(config.ROOT / ".env")

SYSTEM_PROMPT = """You write short follow-up messages for Art of Living volunteers to send to past participants.
Tone: warm, calm, personal, never pushy or salesy.
Rules:
- Mention only facts given in the participant history. Never invent dates, prices, quotes, or health claims.
- Offer exactly one next step: the one provided.
- Fit the channel: WhatsApp/SMS under 60 words, email under 120 words with a subject line.
- Sign off as "Your Art of Living team"."""


def template_message(profile: dict, step: NextStep) -> str:
    return (f"Hi {profile['first_name']}, we've been thinking of you since we last saw you at "
            f"{profile['last_activity']}. We'd love to see you at {step.item}. "
            f"Just reply if you'd like details. Your Art of Living team")


def draft_message(profile: dict, step: NextStep, channel: str) -> str:
    if step.action == "none":  # do-not-contact: never draft, not even a template
        return ""
    if not os.getenv("ANTHROPIC_API_KEY"):
        return template_message(profile, step)

    prompt = (f"Participant: {profile['first_name']}, {profile['city']}\n"
              f"Courses taken: {', '.join(profile['courses_taken']) or 'none'}\n"
              f"Events attended: {profile['num_events']}, seva: {profile['num_seva']}\n"
              f"Last activity: {profile['last_activity']} ({profile['days_since_last']} days ago)\n"
              f"Journey stage: {profile['stage']}\n"
              f"Next step to offer: {step.item} ({step.action})\n"
              f"Channel: {channel}\n\nWrite the message.")
    try:
        response = anthropic.Anthropic().beta.messages.create(
            model=config.LLM_MODEL,
            max_tokens=1024,
            output_config={"effort": "low"},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIError:
        return template_message(profile, step)

    if response.stop_reason == "refusal":
        return template_message(profile, step)
    return "".join(b.text for b in response.content if b.type == "text").strip()
