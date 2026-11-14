"""Build the catalogue of real upcoming programmes from the organisers' mock exports.

Run:  python scripts/build_catalogue.py

Reads  "Mock data/" (local only, never committed):
  harmony_programs.csv        courses        status Scheduled
  eventbrite_events.csv       events         status live
  retreat_guru_programs.csv   retreats       status open
Writes data/catalogue/programmes.csv (git-ignored: it is derived from the organisers' data).

Only programmes starting after AS_OF are kept. Mapping decisions:
  - Harmony programme type -> course key, commitment (1-5), interest tags and prerequisites.
  - Programmes not meant for our participants are kept but marked in `audience`, so the
    recommender can apply a rule rather than this script silently dropping them:
      newcomers  intro / info sessions for people who haven't done SKY
      youth      YES! seminars and youth sessions
      children   Intuition Process for children
      corporate  corporate wellness / lunch & learns
  - Retreat Guru's categories look randomly assigned in the mock (a "Silent Retreat Weekend"
    filed under "Teacher Training"), so retreat tags come from the programme name instead.
  - No source says what language a programme runs in, so `languages` is left blank (= any).
"""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Mock data"
OUT = ROOT / "data" / "catalogue" / "programmes.csv"
AS_OF = "2026-11-14"

COLUMNS = ["offer_id", "offer_type", "name", "program_key", "commitment", "start_date", "end_date",
           "start_time", "duration_min", "city", "venue", "languages", "tags", "prerequisites", "audience",
           "description", "source"]

# Harmony `type` -> (program_key, commitment, tags, prerequisites, audience)
HARMONY_TYPES = {
    "Part1": ("sky", 3, "meditation", "", ""),
    "Sahaj": ("sahaj", 3, "meditation", "", ""),
    "Part2": ("part2", 4, "retreats;meditation", "sky", ""),
    "DSN": ("dsn", 4, "meditation;seva", "part2", ""),
    "Blessing": ("blessing", 3, "meditation", "part2", ""),
    "Yoga": ("yoga", 3, "yoga;wellness", "", ""),
    "Ayur": ("ayurveda", 2, "ayurveda;wellness", "", ""),
    "Online": ("online_workshop", 2, "meditation", "", ""),
    "VTP": ("vtp", 3, "seva;teaching;community", "sky", ""),
    "YES": ("yes", 3, "youth;meditation", "", "youth"),
    "YESPlus": ("yes_plus", 3, "youth;meditation", "", "youth"),
    "IP": ("ip", 2, "family", "", "children"),
    "AOP": ("aop", 2, "family", "", ""),
    "Corp": ("corp", 2, "wellness", "", "corporate"),
    "SMART": ("smart", 3, "seva", "", "corporate"),
}

# Name keywords -> tags, for events and retreats (first match per keyword group)
NAME_TAGS = [
    ("satsang", "satsang;community"), ("celebration", "community;satsang"), ("diwali", "community"),
    ("navratri", "community"), ("yoga", "yoga;wellness"), ("meditation", "meditation"),
    ("breath", "meditation"), ("ayurved", "ayurveda;wellness"), ("panchakarma", "ayurveda;wellness"),
    ("detox", "wellness"), ("silen", "retreats;meditation"), ("retreat", "retreats"),
    ("couples", "family;retreats"), ("sound healing", "wellness"), ("nature", "wellness"),
    ("youth", "youth"), ("writers", "retreats"), ("intensive", "meditation"),
]
EVENT_AUDIENCE = [("info session", "newcomers"), ("free intro", "newcomers"),
                  ("beyond breath", "newcomers"), ("corporate", "corporate"), ("youth", "youth")]


def _minutes(start: str | None, end: str | None):
    """'18:30', '21:30' -> 180. '' when unknown (Retreat Guru only records dates)."""
    if not start or not end:
        return ""
    (h1, m1), (h2, m2) = (map(int, start.split(":")), map(int, end.split(":")))
    return (h2 * 60 + m2) - (h1 * 60 + m1) if (h2, m2) > (h1, m1) else ""


def tags_from_name(name: str) -> str:
    low = name.lower()
    tags = []
    for kw, t in NAME_TAGS:
        if kw in low:
            tags += [x for x in t.split(";") if x not in tags]
    return ";".join(tags)


def harmony() -> list[dict]:
    df = pd.read_csv(SOURCE / "harmony_programs.csv")
    df = df[(df["status"] == "Scheduled") & (df["start_date"] > AS_OF)]
    rows = []
    for r in df.itertuples():
        key, commitment, tags, prereq, audience = HARMONY_TYPES[r.type]
        venue = json.loads(r.venue)
        day1 = (json.loads(r.program_schedules) or [{}])[0]   # first session's local start / end
        # The "Online" programme type is hosted by a centre but delivered on Zoom.
        city = "Online" if (r.type == "Online" or "online" in venue["name"].lower()) else venue["city"]
        rows.append({"offer_id": f"hm_{r.program_id}", "offer_type": "course",
                     "name": json.loads(r.product_name)["en"], "program_key": key, "commitment": commitment,
                     "start_date": r.start_date, "end_date": r.end_date,
                     "start_time": day1.get("start", ""), "duration_min": _minutes(day1.get("start"), day1.get("end")),
                     "city": city, "venue": venue["name"],
                     "tags": tags, "prerequisites": prereq, "audience": audience,
                     "description": f"{r.category} · visibility {r.visibility}", "source": "harmony"})
    return rows


def eventbrite() -> list[dict]:
    events = pd.read_csv(SOURCE / "eventbrite_events.csv")
    venues = pd.read_csv(SOURCE / "eventbrite_venues.csv")[["venue_id", "name", "city"]]
    df = events[(events["status"] == "live") & (events["starts_at"] > AS_OF)]
    df = df.merge(venues.rename(columns={"name": "venue_name", "city": "venue_city"}), on="venue_id", how="left")
    rows = []
    for r in df.itertuples():
        name = r.name.rsplit(" - ", 1)[0]          # "Satsang - Toronto" -> "Satsang"
        low = name.lower()
        audience = next((a for kw, a in EVENT_AUDIENCE if kw in low), "")
        rows.append({"offer_id": f"eb_{r.event_id}", "offer_type": "event", "name": r.name,
                     "program_key": "", "commitment": 2 if "workshop" in low else 1,
                     "start_date": r.starts_at_local[:10], "end_date": r.ends_at_local[:10],
                     "start_time": r.starts_at_local[11:16],
                     "duration_min": _minutes(r.starts_at_local[11:16], r.ends_at_local[11:16]),
                     "city": r.venue_city, "venue": r.venue_name, "tags": tags_from_name(name),
                     "prerequisites": "", "audience": audience, "description": "", "source": "eventbrite"})
    return rows


def retreat_guru() -> list[dict]:
    df = pd.read_csv(SOURCE / "retreat_guru_programs.csv")
    df = df[(df["status"] == "open") & (df["start_date"] > AS_OF)]
    venues = pd.read_csv(SOURCE / "retreat_guru_rental_venues.csv")
    venue_info = {r.venue_id: (r.name, json.loads(r.source_payload).get("city", "")) for r in venues.itertuples()}
    rows = []
    for r in df.itertuples():
        info = json.loads(r.program_info)
        venue, city = venue_info.get(info.get("venue_id"), ("Art of Living Retreat Center", "Boone"))
        nights = int(info.get("nights") or 0)
        training = r.program_type == "training"
        rows.append({"offer_id": f"rg_{r.program_id}", "offer_type": "course" if training else "retreat",
                     "name": r.name, "program_key": "teacher_training" if training else "",
                     "commitment": 5 if training else (4 if nights >= 3 else 3),
                     "start_date": r.start_date, "end_date": r.end_date, "city": city, "venue": venue,
                     "tags": tags_from_name(r.name) or "retreats", "prerequisites": "", "audience": "",
                     "description": f"{nights} nights, residential", "source": "retreat_guru"})
    return rows


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"{SOURCE} not found - the organisers' mock data is local only.")
    df = pd.DataFrame(harmony() + eventbrite() + retreat_guru())
    df["languages"] = ""
    df = df[COLUMNS].sort_values(["start_date", "offer_id"]).reset_index(drop=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT, index=False, lineterminator="\n")
    print(f"Wrote {len(df)} upcoming programmes to {OUT.relative_to(ROOT)}")
    print(df.groupby(["source", "offer_type"]).size().to_string())


if __name__ == "__main__":
    main()
