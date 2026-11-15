"""Build web/src/data/community.json from the organizers' mock data (data/raw/aol_mock).

Only centre-level facts go to the website: centre name, address, coordinates, a coordinator
and teacher contact, and upcoming programs/events. No participant records are included.

Run:  .venv/bin/python scripts/build_community.py
"""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "aol_mock"
OUT = ROOT / "web" / "src" / "data" / "community.json"
AS_OF = "2026-11-14"

# Public city-centre coordinates (lat, lng); the dataset has addresses but no coordinates.
COORDS = {
    "Montreal": (45.5019, -73.5674), "Mississauga": (43.5890, -79.6441), "Boone": (36.2168, -81.6746),
    "Ottawa": (45.4215, -75.6972), "Vancouver": (49.2827, -123.1207), "Toronto": (43.6532, -79.3832),
    "Calgary": (51.0447, -114.0719),
}


def name_of(raw: str) -> str:
    try:
        return json.loads(raw).get("en", raw)
    except (ValueError, AttributeError):
        return str(raw)


progs = pd.read_csv(RAW / "harmony_programs.csv")
people = pd.read_csv(RAW / "harmony_program_people.csv")
events = pd.read_csv(RAW / "eventbrite_events.csv")
venues = pd.read_csv(RAW / "eventbrite_venues.csv")

centres = []
for centre, rows in progs.groupby("center_name"):
    venue = json.loads(rows.iloc[0]["venue"])
    city = venue["city"]
    if city not in COORDS:  # skip "Online - Zoom"
        continue
    staff = people[people["program_source_record_id"].isin(rows["source_record_id"])]
    contacts = []
    for role in ("Coordinator", "Teacher"):
        r = staff[staff["role"] == role]
        if len(r):
            p = r.iloc[0]
            contacts.append({"role": role, "name": p["name"], "email": p["email"], "phone": p["mobile_phone"]})

    upcoming = rows[rows["start_date"] >= AS_OF].sort_values("start_date").head(4)
    items = [{"name": name_of(p["product_name"]), "date": p["start_date"], "kind": "course",
              "url": p["registration_url"] if isinstance(p["registration_url"], str) else None}
             for _, p in upcoming.iterrows()]

    vids = venues[venues["city"] == city]["venue_id"]
    ev = events[events["venue_id"].isin(vids)]
    date_col = next((c for c in ("starts_at_local", "starts_at", "start") if c in ev.columns), None)
    name_col = next((c for c in ("name", "title") if c in ev.columns), None)
    if date_col and name_col:
        ev = ev[ev[date_col].astype(str) >= AS_OF].sort_values(date_col).head(3)
        items += [{"name": name_of(e[name_col]).split(" - ")[0], "date": str(e[date_col])[:10], "kind": "event",
                   "url": e["url"] if isinstance(e.get("url"), str) else None} for _, e in ev.iterrows()]

    # Seva / volunteering opportunities at this centre (Volunteer Training etc.), shown as seva locations on the map.
    vol = rows[rows["product_name"].astype(str).str.contains("Volunteer|Seva", case=False)].sort_values("start_date")
    upcoming_vol, past_vol = vol[vol["start_date"] >= AS_OF], vol[vol["start_date"] < AS_OF]
    pick = upcoming_vol.head(2) if len(upcoming_vol) else past_vol.tail(1)
    seva = [{"name": name_of(p["product_name"]), "date": p["start_date"], "kind": "seva", "past": p["start_date"] < AS_OF,
             "url": p["registration_url"] if isinstance(p["registration_url"], str) and p["start_date"] >= AS_OF else None}
            for _, p in pick.iterrows()]

    lat, lng = COORDS[city]
    centres.append({
        "id": city.lower(), "name": centre, "city": city, "region": venue["region"], "country": venue["country"],
        "address": f'{venue["address"]}, {city}, {venue["region"]}', "lat": lat, "lng": lng,
        "contacts": contacts, "upcoming": sorted(items, key=lambda x: x["date"])[:6], "seva": seva,
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({"source": "Hackathon mock data (sample addresses and contacts)", "centres": centres}, indent=1, ensure_ascii=False))
print(f"Wrote {len(centres)} centres to {OUT}")
for c in centres:
    print(f'  {c["city"]:12} contacts={len(c["contacts"])} upcoming={len(c["upcoming"])} seva={len(c["seva"])}')
