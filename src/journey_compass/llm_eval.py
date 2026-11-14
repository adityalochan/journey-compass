"""Answer key for the LLM steps: do the 10 people we know get sensible picks and clean messages?

Run before and after any prompt or model change:
    python -m journey_compass.llm_eval          (JC_LLM_PROVIDER in .env; synthetic data only)

Each expectation is what a coordinator who knows the person would accept, written from their
notes. It's deliberately loose ("some seva", "a small ask"), not "exactly this offer".
Every message must also pass messaging.check (no leaked notes, right language, length...).
"""
import sys

from . import config, llm
from .catalogue import load_catalogue
from .channel import suggest_channel
from .chooser import choose
from .data_loader import load_dataset
from .journey import build_profiles
from .messaging import draft

# pid -> (what we expect, test on (step, commitment, channel))
EXPECT = {
    "p_001": ("Priya (evenings only, new job): a small ask", lambda s, c, ch: c <= 2),
    "p_002": ("Marc (asked about a retreat with his partner): a couples retreat, or a call about it",
              lambda s, c, ch: "couple" in s.item.lower() or s.offer_id == "reconnect_call"),
    "p_003": ("Amrit (wants to serve, not another course): a seva role",
              lambda s, c, ch: s.offer_type == "seva"),
    "p_004": ("Daniel (new, asked about the 40-day app): the 40-day challenge or an easy event",
              lambda s, c, ch: s.offer_id == "event_40day" or (s.offer_type == "event" and c <= 2)),
    "p_005": ("Wei (dormant, moved): a small ask", lambda s, c, ch: c <= 2),
    "p_006": ("Gurpreet (dormant, travels for work): a small ask", lambda s, c, ch: c <= 2),
    "p_007": ("Sophie (never picks up the phone, bar exam): no phone call, a small ask",
              lambda s, c, ch: s.offer_id != "reconnect_call" and not ch.startswith("Phone") and c <= 2),
    "p_008": ("Aisha (YES! grad, at university): not a course, a small ask", lambda s, c, ch: s.offer_type != "course" and c <= 2),
    "p_009": ("Tom (retired teacher, great with newcomers): seva", lambda s, c, ch: s.offer_type == "seva"),
    "p_010": ("Neha (asked about volunteering as a course coordinator): seva",
              lambda s, c, ch: s.offer_type == "seva"),
}


def main() -> int:
    if llm.provider() is None:
        print("Set JC_LLM_PROVIDER (groq or ollama) to run the answer key.")
        return 2
    ds = load_dataset(config.ROOT / "data" / "synthetic")
    cat = load_catalogue()
    commitment = cat.set_index("offer_id")["commitment"]
    profiles = build_profiles(ds).set_index("participant_id")
    picks_ok = messages_ok = 0
    for pid, (expect, ok) in EXPECT.items():
        profile = profiles.loc[pid].to_dict() | {"participant_id": pid}
        contacts = ds.contacts[ds.contacts["participant_id"] == pid]
        choice, steps = choose(profile, cat, ds.as_of, contacts)
        step = next(s for s in steps if s.offer_id == choice.offer_id)
        channel = suggest_channel(profile, step.action)
        pick_ok = ok(step, int(commitment[step.offer_id]), channel)
        d = draft(profile, step, channel, choice.message_angle, contacts)
        msg_ok = d.source == "llm"
        picks_ok += pick_ok
        messages_ok += msg_ok
        print(f"{'PASS' if pick_ok else 'FAIL'} pick | {'PASS' if msg_ok else 'FAIL'} message | {expect}\n"
              f"      got: {step.item} [{choice.source}] via {channel}"
              + (f"\n      message fell back to template: {'; '.join(d.problems)}" if not msg_ok else ""))
    print(f"\nPicks: {picks_ok}/{len(EXPECT)} as expected. Messages: {messages_ok}/{len(EXPECT)} written and passed checks.")
    return 0 if picks_ok == messages_ok == len(EXPECT) else 1


if __name__ == "__main__":
    sys.exit(main())
