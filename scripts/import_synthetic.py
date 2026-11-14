"""Convert the synthetic cohort (data/synthetic/cohort.json) into the pipeline's CSV schema.

Run:  python scripts/import_synthetic.py

Writes, into data/synthetic/:
  participants.csv  - one row per person. The first six columns match data/sample exactly;
                      extra columns are appended after them, so existing code keeps working.
  activities.csv    - courses, events and seva. The first four columns match data/sample.
  contacts.csv      - the outreach / reply log ("last contact" in the brief).

The output is deterministic: same JSON in, byte-identical CSVs out.

Deliberately NOT exported:
  archetype, hero - generator ground-truth labels. The engine must infer stage from behaviour,
                    so exporting the answer key would make any evaluation meaningless.
  email, phone    - not needed by the engine.
"""
import json
from pathlib import Path

import pandas as pd

DIR = Path(__file__).resolve().parents[1] / "data" / "synthetic"
SOURCE = DIR / "cohort.json"

# Synthetic programme ids -> course names used in config.COURSE_PATH, so the existing rules
# apply unchanged. "part2" and "silence" are separate programmes in the generator (5 people
# have both), so they stay separate here.
COURSE_NAMES = {
    "sky": "Art of Living Part 1 (SKY)",
    "sahaj": "Sahaj Samadhi Meditation",
    "part2": "Art of Living Part 2 (Silence Retreat)",
    "silence": "Silence Retreat",
    "yes": "YES! for Youth",
}

# Synthetic event types -> the pipeline's activity_type. The original type is kept in `subtype`.
ACTIVITY_TYPE = {"seva": "seva"}  # everything else (followup, satsang, celebration, retreat) is an event

REMOTE_CHANNELS = {"whatsapp", "email", "phone"}  # in_person can't be a follow-up channel


def preferred_channel(p: dict) -> tuple[str, str]:
    """Return (channel, source). A stated preference always wins; otherwise infer, and say so."""
    if p.get("contactPreference"):
        return p["contactPreference"], "stated"
    contacts = sorted(p["contacts"], key=lambda c: c["at"], reverse=True)
    for direction in ("in", "out"):  # the channel they last answered us on beats the one we last used
        for c in contacts:
            if c["direction"] == direction and c["channel"] in REMOTE_CHANNELS:
                return c["channel"], "inferred"
    return "email", "default"


def participant_row(p: dict) -> dict:
    dnc = bool(p.get("doNotContact"))
    channel, source = preferred_channel(p)
    replied_on_whatsapp = any(c["channel"] == "whatsapp" and c["direction"] == "in" for c in p["contacts"])
    s = p["signals"]
    return {
        # --- same columns, same order as data/sample/participants.csv ---
        "participant_id": p["id"],
        "first_name": p["firstName"],
        "city": p["city"],
        "preferred_channel": channel,
        # Assumption: an email address given at course registration means email is allowed.
        "email_opt_in": not dnc,
        # Assumption: WhatsApp only if they have messaged us there themselves.
        "whatsapp_opt_in": (replied_on_whatsapp or s["whatsappReplies30d"] > 0) and not dnc,
        # --- appended ---
        "last_name": p["lastName"],
        "province": p["province"],
        "language": p["language"],
        "assigned_to": p["assignedTo"],
        "joined_at": p["joinedAt"],
        "preferred_channel_source": source,
        "do_not_contact": dnc,
        "invites": p["invites"],
        "app_opens_30d": s["appOpens30d"],
        "email_opens_30d": s["emailOpens30d"],
        "whatsapp_replies_30d": s["whatsappReplies30d"],
        "video_minutes_30d": s["videoMinutes30d"],
        "skills": "; ".join(p["skills"]),
        "interests": "; ".join(p["interests"]),
        # Volunteer observations: for the coordinator's eyes. Never send these to the LLM.
        "notes": " | ".join(p["notes"]),
    }


def activity_rows(p: dict) -> list[dict]:
    rows = [{"participant_id": p["id"], "date": c["completedAt"], "activity_type": "course",
             "name": COURSE_NAMES[c["programId"]], "subtype": c["programId"], "city": c["city"]}
            for c in p["courses"]]
    rows += [{"participant_id": p["id"], "date": e["date"], "activity_type": ACTIVITY_TYPE.get(e["type"], "event"),
              "name": e["name"], "subtype": e["type"], "city": e["city"]}
             for e in p["events"]]
    return rows


def contact_rows(p: dict) -> list[dict]:
    return [{"participant_id": p["id"], "at": c["at"], "channel": c["channel"],
             "direction": c["direction"], "summary": c["summary"]} for c in p["contacts"]]


def main() -> None:
    cohort = json.loads(SOURCE.read_text(encoding="utf-8"))
    unknown = {c["programId"] for p in cohort for c in p["courses"]} - COURSE_NAMES.keys()
    if unknown:
        raise SystemExit(f"Unmapped programme ids: {sorted(unknown)} - add them to COURSE_NAMES")

    participants = pd.DataFrame([participant_row(p) for p in cohort]).sort_values("participant_id")
    activities = (pd.DataFrame([r for p in cohort for r in activity_rows(p)])
                  .sort_values(["participant_id", "date", "activity_type", "name"], kind="stable"))
    contacts = (pd.DataFrame([r for p in cohort for r in contact_rows(p)])
                .sort_values(["participant_id", "at"], kind="stable"))

    for name, df in [("participants", participants), ("activities", activities), ("contacts", contacts)]:
        df.to_csv(DIR / f"{name}.csv", index=False, lineterminator="\n")
    print(f"Wrote {len(participants)} participants, {len(activities)} activities, "
          f"{len(contacts)} contacts to {DIR}")


if __name__ == "__main__":
    main()
