"""Step 3b: draft the follow-up message a volunteer sends.

The writer (an LLM, via llm.py) never sees volunteer notes or contact history. It gets only:
first name, the chosen offer (name, when, where), a participant-safe angle (from the chooser, or a
template line), the channel and the language. So a note can't be echoed back to the person.

Every draft is then checked:
  leak      shares a phrase of 4+ words with their notes / contact summaries, or says things
            like "you mentioned" / "we noted"
  length    WhatsApp/SMS <= 60 words, phone opener <= 50, email <= 120 plus a subject line
  language  French for French speakers, English for everyone else
  dates     no month named that isn't the offer's own
A failed draft is retried once with the problems listed; after that the template is used.
With no LLM configured, the template is used directly. Do-not-contact people get nothing.
"""
import re
from dataclasses import dataclass, field

import pandas as pd

from . import config, llm
from .recommender import NextStep

SIGN_OFF = {"English": "Your Art of Living team", "French": "Votre équipe Art of Living"}
LIMITS = {"WhatsApp": 60, "SMS": 60, "Phone call (volunteer)": 50, "Email": 120}
LEAK_PHRASES = ["you mentioned", "you told us", "you said", "we noted", "we heard", "our notes", "our records",
                "you shared that", "vous avez mentionné", "vous nous avez dit", "nous avons noté", "vous avez dit"]
MONTHS_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september",
             "october", "november", "december"]
MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre",
             "octobre", "novembre", "décembre"]
FRENCH_WORDS = {"le", "la", "les", "et", "vous", "nous", "de", "une", "pour", "votre", "avec", "est"}
ENGLISH_WORDS = {"the", "and", "you", "we", "to", "of", "your", "for", "with", "is", "a"}

WRITER_SYSTEM = """You write short follow-up messages that Art of Living volunteers send to past participants.
Tone: warm, calm, personal, never pushy, salesy or guilt-tripping.
Rules:
- Use only the facts given. Never invent dates, times, prices, places, quotes or health claims.
- Offer exactly the one next step given, and build the message on the angle given.
- Never refer to notes, records, past conversations or anything "they mentioned".
- Write entirely in the language given, including the sign-off.
- Email: the first line is the subject, starting with exactly the subject prefix given; then at most
  120 words. WhatsApp or SMS: at most 60 words, no subject.
- Phone call: a friendly opening the volunteer says, in the first person, using the volunteer's name
  given; at most 50 words, no subject, no sign-off.
- Never leave placeholders such as [Your Name] or [date].
- Otherwise end with the sign-off given.
Output only the message."""
SUBJECT_PREFIX = {"English": "Subject:", "French": "Objet :"}


@dataclass
class Draft:
    text: str
    source: str                       # "llm" | "template" | "none"
    problems: list = field(default_factory=list)   # why an LLM draft was rejected, if it was
    model: str = ""


def language_for(profile: dict) -> str:
    return "French" if str(profile.get("language") or "en") == "fr" else "English"


DAYS_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


def _when_where(step: NextStep, lang: str = "English") -> str:
    fr = lang == "French"
    if step.offer_id == "reconnect_call":
        return "un appel, au moment qui vous convient" if fr else "a phone call, at a time that suits them"
    if step.when in ("", "any time"):
        if step.where == "Online":
            return "en ligne, quand vous voulez" if fr else "online, whenever suits them"
        return "à votre centre local, date à convenir" if fr else "at their local centre, date to be arranged"
    d = pd.Timestamp(step.when)
    if fr:
        place = ("en ligne" if step.where == "Online" else
                 "à votre centre local" if step.where == "local centre" else f"à {step.where}")
        return f"{DAYS_FR[d.day_of_week]} {d.day} {MONTHS_FR[d.month - 1]} {d.year}, {place}"
    place = ("online" if step.where == "Online" else
             "at their local centre" if step.where == "local centre" else f"in {step.where}")
    return f"{d:%A} {d.day} {d:%B} {d.year}, {place}"


def template_message(profile: dict, step: NextStep, channel: str, angle: str = "") -> str:
    lang = language_for(profile)
    name = profile.get("first_name", "")
    when = _when_where(step, lang)
    if lang == "French":
        body = f"Bonjour {name}, nous pensions à vous. {angle + ' ' if angle else ''}" \
               f"Nous aimerions vous proposer : {step.item} ({when}). Répondez simplement si cela vous intéresse."
    else:
        body = f"Hi {name}, we've been thinking of you. {angle + ' ' if angle else ''}" \
               f"We'd love to invite you to {step.item} ({when}). Just reply if you'd like the details."
    if channel == "Phone call (volunteer)":
        return body
    if channel == "Email":
        subject = f"{SUBJECT_PREFIX[lang]} {step.item}"
        return f"{subject}\n\n{body}\n\n{SIGN_OFF[lang]}"
    return f"{body} {SIGN_OFF[lang]}"


# ---------------------------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------------------------
def _words(text: str) -> list[str]:
    return re.findall(r"[a-zà-ÿ']+", text.lower())


def _private_texts(profile: dict, contacts: pd.DataFrame | None) -> list[str]:
    texts = [t for t in str(profile.get("notes") or "").split("|") if t.strip() and t.strip() != "nan"]
    if contacts is not None and len(contacts):
        texts += [s for s in contacts["summary"].fillna("") if s.strip()]
    return texts


def check(text: str, profile: dict, step: NextStep, channel: str, contacts: pd.DataFrame | None = None) -> list[str]:
    problems = []
    low = text.lower()
    words = _words(text)
    # leak: a 4-word run shared with a private text, or a "you mentioned"-style phrase
    grams = {" ".join(words[i:i + 4]) for i in range(len(words) - 3)}
    for private in _private_texts(profile, contacts):
        pw = _words(private)
        if grams & {" ".join(pw[i:i + 4]) for i in range(len(pw) - 3)}:
            problems.append("repeats wording from their notes or contact history")
            break
    if any(p in low for p in LEAK_PHRASES):
        problems.append("refers to something they mentioned / our notes")
    # length (the subject line doesn't count)
    body = re.sub(r"^(subject|objet)\s*:.*\n", "", text.strip(), flags=re.I)
    limit = LIMITS.get(channel, 60)
    if len(_words(body)) > limit:
        problems.append(f"too long ({len(_words(body))} words; limit {limit})")
    lang = language_for(profile)
    if channel == "Email":
        if not re.match(r"^(subject|objet)\s*:", text.strip(), flags=re.I):
            problems.append("email has no subject line")
        elif not text.strip().lower().startswith(SUBJECT_PREFIX[lang].lower().replace(" :", "").rstrip(":")):
            problems.append(f"subject line should start with '{SUBJECT_PREFIX[lang]}'")
    elif re.match(r"^(subject|objet)\s*:", text.strip(), flags=re.I):
        problems.append(f"a {channel} message has no subject line")
    if re.search(r"\[[^\]]{2,40}\]", text):
        problems.append("contains a placeholder like [Your Name]")
    first = str(profile.get("first_name") or "").strip()
    if first and first.lower() not in low:
        problems.append(f"doesn't greet {first} by name")
    # language
    fr, en = sum(w in FRENCH_WORDS for w in words), sum(w in ENGLISH_WORDS for w in words)
    if (lang == "French" and fr <= en) or (lang == "English" and en <= fr):
        problems.append(f"not written in {lang}")
    # dates: no month other than the offer's own
    allowed = set()
    if step.when not in ("", "any time"):
        m = pd.Timestamp(step.when).month - 1
        allowed = {MONTHS_EN[m], MONTHS_FR[m]}
    named = {w for w in words if w in MONTHS_EN or w in MONTHS_FR} - {"may"}   # "may" is also a verb
    if named - allowed:
        problems.append(f"mentions a month not in the offer: {', '.join(sorted(named - allowed))}")
    return problems


# ---------------------------------------------------------------------------------------------
# Drafting
# ---------------------------------------------------------------------------------------------
def draft(profile: dict, step: NextStep, channel: str, angle: str = "",
          contacts: pd.DataFrame | None = None) -> Draft:
    if step.action == "none" or not channel:      # do-not-contact: never draft, not even a template
        return Draft("", "none")
    lang = language_for(profile)
    volunteer = str(profile.get("assigned_to") or "").split(" ")[0] or "your coordinator"
    brief = (f"First name: {profile.get('first_name', '')}\n"
             f"Next step to offer: {step.item}\n"
             f"When and where: {_when_where(step, lang)}\n"
             f"Angle to build on: {angle or 'a warm, simple invitation'}\n"
             f"Channel: {channel}\nLanguage: {lang}\n"
             + (f"Subject prefix: {SUBJECT_PREFIX[lang]}\n" if channel == "Email" else "")
             + (f"Volunteer's name: {volunteer}\n" if channel.startswith("Phone") else "")
             + f"Sign-off: {SIGN_OFF[lang]}")
    try:
        if llm.provider() is None:
            return Draft(template_message(profile, step, channel, angle), "template")
        text, info = llm.chat(WRITER_SYSTEM, brief, temperature=0.5)
        problems = check(text, profile, step, channel, contacts)
        if problems:
            retry = brief + "\n\nYour previous draft had these problems; fix them:\n- " + "\n- ".join(problems)
            text, info = llm.chat(WRITER_SYSTEM, retry, temperature=0.3)
            problems = check(text, profile, step, channel, contacts)
        if problems:
            return Draft(template_message(profile, step, channel, angle), "template", problems, info["model"])
        return Draft(text.strip(), "llm", [], info["model"])
    except llm.LLMUnavailable as e:
        return Draft(template_message(profile, step, channel, angle), "template", [str(e)])


def draft_message(profile: dict, step: NextStep, channel: str, angle: str = "") -> str:
    """Text only; what the dashboard's Draft button and the pipeline use."""
    return draft(profile, step, channel, angle).text


# ---------------------------------------------------------------------------------------------
# Try it:  python -m journey_compass.messaging p_001 p_002      (JC_LLM_PROVIDER in .env)
# ---------------------------------------------------------------------------------------------
def main(pids: list[str]) -> None:
    import time

    from .catalogue import load_catalogue
    from .channel import suggest_channel
    from .chooser import choose
    from .data_loader import load_dataset
    from .journey import build_profiles

    ds = load_dataset()
    cat = load_catalogue()
    profiles = build_profiles(ds).set_index("participant_id")
    sources = []
    for pid in pids:
        profile = profiles.loc[pid].to_dict() | {"participant_id": pid}
        contacts = ds.contacts[ds.contacts["participant_id"] == pid]
        choice, steps = choose(profile, cat, ds.as_of, contacts)
        step = next((s for s in steps if s.offer_id == choice.offer_id), None)
        if step is None:
            print(f"\n{profile['first_name']}: no message ({choice.note})")
            continue
        channel = suggest_channel(profile, step.action)
        t = time.time()
        d = draft(profile, step, channel, choice.message_angle, contacts)
        sources.append(d.source)
        print(f"\n=== {profile['first_name']} ({profile['journey_stage']}, {language_for(profile)}) -> {step.item} "
              f"[{choice.source}] via {channel} | message: {d.source} {d.model} {time.time() - t:.1f}s")
        if d.problems:
            print(f"    rejected LLM draft because: {'; '.join(d.problems)}")
        print("    " + d.text.replace("\n", "\n    "))
    print(f"\nMessages: {sources.count('llm')} written by the LLM, {sources.count('template')} fell back to the template.")


if __name__ == "__main__":
    import sys
    main(sys.argv[1:] or [f"p_{i:03d}" for i in range(1, 11)])
