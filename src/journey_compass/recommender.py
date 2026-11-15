"""Next step: filter the catalogue with hard rules, score what's left, pick a varied top 3.

  1. Hard rules (never bend): do-not-contact, prerequisites, not repeating a course, audience,
     language, location, timing. See `eligibility`.
  2. Fit score: five parts, each 0..1, weighted by config.FIT_WEIGHTS. See `score`.
       stage_fit    how often people in this stage take up this kind of offer (the config
                    prior, updated from recorded outcomes by learning.py)
       commitment   size of the ask vs their momentum
       interest     tags vs their skills / interests / what they attend
       progression  the natural next course on their path
       logistics    starts soon, close by
  3. Top 3: highest score first; an offer whose type is already picked loses SAME_TYPE_PENALTY,
     so the three are usually different kinds of step.
Each recommendation carries a reason built from the parts that contributed most.
"""
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from . import config

ACTION = {"course": "follow_on_course", "retreat": "retreat", "seva": "seva",
          "event": "event", "reconnect": "re_engage"}
# What a coordinator would call each simple stage, for profiles from older callers.
SIMPLE_TO_JOURNEY = {"Active": "Active", "Cooling": "Slipping", "Dormant": "Dormant"}
# Attended activity subtypes -> interest tags.
ATTENDED_TAGS = {"satsang": "satsang", "celebration": "community", "seva": "seva",
                 "retreat": "retreats", "followup": "meditation"}


@dataclass
class NextStep:
    action: str            # follow_on_course | retreat | seva | event | re_engage | none
    item: str              # what specifically to offer
    reason: str            # why, shown to coordinators
    offer_id: str = ""
    offer_type: str = ""
    score: float = 0.0
    when: str = ""         # "2027-01-02" or "any time"
    where: str = ""        # city / "Online" / "local centre"
    parts: dict = field(default_factory=dict)


def is_do_not_contact(profile: dict) -> bool:
    # `in (True, 1)` rather than truthiness: a missing value from pandas is NaN, and bool(NaN) is True.
    return profile.get("do_not_contact") in (True, 1)


def _split(value) -> set:
    return {v.strip().lower() for v in str(value or "").split(";") if v.strip() and str(value) != "nan"}


def _name_key(name: str) -> str:
    """'Meditation & Breath Workshop - Online' and 'Online Meditation & Breath Workshop' -> same key."""
    words = "".join(c if c.isalnum() else " " for c in name.lower()).split()
    cities = {c.lower() for cs in config.METROS.values() for c in cs}
    return " ".join(sorted(w for w in words if w not in {"online", "the", "of", "at", "your"} | cities))


def _metro(city: str) -> str:
    for metro, cities in config.METROS.items():
        if city in cities:
            return metro
    return city


def _done(profile: dict) -> set:
    keys = set(profile.get("course_keys") or [])
    if not keys:   # older callers only pass course names
        keys = {config.COURSE_KEYS.get(n, "") for n in profile.get("courses_taken") or []} - {""}
    for key, alternatives in config.COURSE_EQUIVALENTS.items():
        if keys & set(alternatives):
            keys.add(key)
    return keys


def _stage(profile: dict) -> str:
    stage = profile.get("journey_stage")
    if stage in config.STAGES:
        return stage
    return SIMPLE_TO_JOURNEY.get(profile.get("stage"), "Active")


def _interests(profile: dict) -> tuple[set, set]:
    """(skills, interests). Interests include what they attend, for people who stated none."""
    skills = _split(profile.get("skills"))
    interests = _split(profile.get("interests"))
    interests |= {ATTENDED_TAGS[a] for a in profile.get("attended") or [] if a in ATTENDED_TAGS}
    return skills, interests


# ---------------------------------------------------------------------------------------------
# 1. Hard rules
# ---------------------------------------------------------------------------------------------
def eligibility(profile: dict, cat: pd.DataFrame, as_of: pd.Timestamp) -> pd.Series:
    """Why each offer is NOT allowed for this person ('' = allowed)."""
    done = _done(profile)
    _, interests = _interests(profile)
    lang = str(profile.get("language") or "en")
    home = _metro(str(profile.get("city") or ""))

    def why_not(o) -> str:
        prereq = _split(o.prerequisites)
        if prereq - done:
            return "missing prerequisite " + ", ".join(sorted(prereq - done))
        if o.offer_type == "course" and o.program_key and o.program_key in done:
            return "already done"
        aud = o.audience
        if aud in ("children", "corporate"):
            return f"for {aud}"
        if aud == "newcomers" and done:
            return "intro for newcomers"
        if aud == "youth" and "youth" not in interests:
            return "for youth"
        langs = _split(o.languages)
        if langs and lang not in langs and not ("en" in langs and lang != "fr"):
            return "language"
        if o.city not in ("", "Online") and o.offer_type != "retreat" and _metro(o.city) != home:
            return "not local"
        if pd.notna(o.start_date):
            days = (o.start_date - as_of).days
            if days <= 0:
                return "already started"
            if days > config.OFFER_HORIZON_DAYS:
                return "too far ahead"
        return ""

    return pd.Series([why_not(o) for o in cat.itertuples()], index=cat.index)


# ---------------------------------------------------------------------------------------------
# 2. Fit score
# ---------------------------------------------------------------------------------------------
def score(profile: dict, cat: pd.DataFrame, as_of: pd.Timestamp) -> pd.DataFrame:
    """One row per offer in `cat` with each part (0..1), the weighted total and the facts used."""
    stage = _stage(profile)
    prior = config.ACCEPTANCE_RATES[stage]
    top_prior = max(prior.values())
    engagement = float(profile.get("engagement_score") if pd.notna(profile.get("engagement_score")) else 50)
    ideal = 1 + 4 * engagement / 100                        # momentum -> comfortable size of ask, 1..5
    skills, interests = _interests(profile)
    done = _done(profile)
    next_course = next((c for c in config.COURSE_PATH if c not in done), None)
    home_city = str(profile.get("city") or "")
    home = _metro(home_city)

    rows = []
    for o in cat.itertuples():
        tags = _split(o.tags)
        skill_hit, interest_hit = sorted(tags & skills), sorted(tags & interests)
        if o.offer_type == "course":
            progression = 1.0 if o.program_key == next_course else (
                0.6 if o.program_key in config.COURSE_PATH else 0.3)
        else:
            progression = 0.0
        if pd.isna(o.start_date):
            soon, when = 0.7, "any time"
        else:
            days = (o.start_date - as_of).days
            soon = float(np.clip(1 - 0.7 * (days - 30) / 90, 0.3, 1.0))
            when = o.start_date.strftime("%Y-%m-%d")
        if o.city == "":
            place, where = 0.9, "local centre"
        elif o.city == "Online":
            place, where = 0.7, "Online"
        elif o.city == home_city:
            place, where = 1.0, o.city
        elif _metro(o.city) == home:
            place, where = 0.85, o.city
        else:
            place, where = 0.4, o.city                       # a residential retreat elsewhere
        rows.append({
            "offer_id": o.offer_id,
            "stage_fit": prior[o.offer_type] / top_prior,
            "commitment": 1 - abs(o.commitment - ideal) / 4,
            # One kind of match (skill or interest) = 0.7, both = 1.0.
            "interest": 0.7 * bool(skill_hit or interest_hit) + 0.3 * bool(skill_hit and interest_hit),
            "progression": progression,
            "logistics": 0.5 * soon + 0.5 * place,
            "skill_hit": skill_hit, "interest_hit": interest_hit, "when": when, "where": where,
        })
    parts = pd.DataFrame(rows, index=cat.index)
    parts["score"] = sum(config.FIT_WEIGHTS[k] * parts[k] for k in config.FIT_WEIGHTS)
    parts.attrs.update(stage=stage, ideal=ideal, next_course=next_course)
    return parts


def _reason(o, p, stage: str, ideal: float, next_course: str | None) -> str:
    """Two strongest parts in words, then when and where."""
    said = {
        "stage_fit": f"{o.offer_type} suits someone who is {stage.lower()}",
        "commitment": ("a small ask that fits their momentum" if o.commitment <= 2
                       else "a bigger step that matches their momentum"),
        "interest": (f"uses their {', '.join(p['skill_hit'])} skill" if p["skill_hit"]
                     else f"matches their interest in {', '.join(p['interest_hit'])}"),
        "progression": (f"next on their path ({config.COURSE_LABELS.get(next_course, next_course)})"
                        if o.program_key == next_course else "a deeper course they haven't done"),
    }
    # Specific reasons (their path, their skills / interests) come before generic ones.
    order = []
    if p["progression"] > 0:
        order.append("progression")
    if p["skill_hit"] or p["interest_hit"]:
        order.append("interest")
    generic = sorted(["stage_fit", "commitment"], key=lambda k: config.FIT_WEIGHTS[k] * p[k], reverse=True)
    top = (order + generic)[:2]
    where = {"local centre": "at their local centre", "Online": "online"}.get(p["where"], f"in {p['where']}")
    when = "" if p["when"] == "any time" else f", starts {p['when']}"
    return "; ".join(said[k] for k in top) + f" ({where}{when})"


# ---------------------------------------------------------------------------------------------
# 3. Top 3
# ---------------------------------------------------------------------------------------------
def _allowed_and_scored(profile: dict, cat: pd.DataFrame, as_of: pd.Timestamp):
    allowed = cat[eligibility(profile, cat, as_of) == ""]
    return allowed, (score(profile, allowed, as_of) if len(allowed) else None)


def _step(o, p, attrs: dict) -> NextStep:
    return NextStep(ACTION[o.offer_type], o["name"], _reason(o, p, attrs["stage"], attrs["ideal"], attrs["next_course"]),
                    offer_id=o.offer_id, offer_type=o.offer_type, score=round(float(p["score"]), 2),
                    when=p["when"], where=p["where"], parts={c: round(float(p[c]), 2) for c in config.FIT_WEIGHTS})


def recommend_top(profile: dict, cat: pd.DataFrame, as_of: pd.Timestamp, k: int = config.TOP_K) -> list[NextStep]:
    if is_do_not_contact(profile):
        return [NextStep("none", "", "Asked not to be contacted.")]
    allowed, parts = _allowed_and_scored(profile, cat, as_of)
    if allowed.empty:
        return [NextStep("none", "", "No offer passes the rules (check location, language, prerequisites).")]
    remaining = parts["score"].copy()
    picked, steps = set(), []
    for _ in range(min(k, len(allowed))):
        adjusted = remaining - allowed["offer_type"].isin(picked) * config.SAME_TYPE_PENALTY
        if not np.isfinite(adjusted.max()):
            break
        i = adjusted.idxmax()
        o = allowed.loc[i]
        steps.append(_step(o, parts.loc[i], parts.attrs))
        picked.add(o.offer_type)
        # Same offer, or the same course in another city, can't appear twice.
        same = (allowed["offer_id"] == o.offer_id) | (
            (allowed["program_key"] != "") & (allowed["program_key"] == o.program_key)) | (
            allowed["name"].map(_name_key) == _name_key(o["name"]))
        remaining[same] = -np.inf
    return steps


def best_per_type(profile: dict, cat: pd.DataFrame, as_of: pd.Timestamp, n: int = 1) -> list[NextStep]:
    """The n highest-scoring allowed offers of each kind (course, retreat, seva, event, reconnect).
    The same programme twice (another city, or another source system) counts once."""
    if is_do_not_contact(profile):
        return []
    allowed, parts = _allowed_and_scored(profile, cat, as_of)
    if allowed.empty:
        return []
    out = []
    for _, idx in allowed.groupby("offer_type").groups.items():
        seen = set()
        for i in parts.loc[idx, "score"].sort_values(ascending=False).index:
            o = allowed.loc[i]
            key = o.program_key or _name_key(o["name"])
            if key in seen:
                continue
            seen.add(key)
            out.append(_step(o, parts.loc[i], parts.attrs))
            if len(seen) == n:
                break
    return sorted(out, key=lambda s: -s.score)


def recommend(profile: dict, cat: pd.DataFrame | None = None, as_of: pd.Timestamp | None = None) -> NextStep:
    """The single top recommendation (what the dashboard's Draft button uses)."""
    from .catalogue import load_catalogue
    cat = load_catalogue() if cat is None else cat
    as_of = pd.Timestamp(config.AS_OF) if as_of is None and config.AS_OF else (as_of or pd.Timestamp.today().normalize())
    return recommend_top(profile, cat, as_of, k=1)[0]
