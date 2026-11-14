"""Generate SYNTHETIC sample data so the pipeline runs before the real data arrives.

Run:  python scripts/make_sample_data.py
"""
import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

random.seed(42)
OUT = Path(__file__).resolve().parents[1] / "data" / "sample"
TODAY = date.today()

NAMES = ["Asha", "Ravi", "Maya", "John", "Priya", "Liam", "Sara", "Arjun", "Emma", "Kiran",
         "Noah", "Meera", "Olivia", "Dev", "Ananya", "Lucas", "Isha", "Ethan", "Nina", "Rohan"]
CITIES = ["Toronto", "Mississauga", "Brampton", "Ottawa", "Vancouver"]
COURSES = ["Art of Living Part 1 (SKY)", "Sahaj Samadhi Meditation",
           "Art of Living Part 2 (Silence Retreat)", "Advanced Meditation (DSN)"]
EVENTS = ["Weekly SKY follow-up", "Satsang", "Guided meditation night", "Yoga in the park"]
SEVA = ["Intro talk volunteer", "Event setup seva"]

participants, activities = [], []
for i, name in enumerate(NAMES, start=1):
    pid = f"P{i:03d}"
    pref = random.choice(["email", "whatsapp"])
    participants.append({
        "participant_id": pid, "first_name": name, "city": random.choice(CITIES),
        "preferred_channel": pref, "email_opt_in": True, "whatsapp_opt_in": pref == "whatsapp",
    })
    start = TODAY - timedelta(days=random.randint(20, 400))
    activities.append({"participant_id": pid, "date": start, "activity_type": "course", "name": COURSES[0]})
    d = start
    for _ in range(random.randint(0, 10)):
        d += timedelta(days=random.randint(5, 35))
        if d > TODAY:
            break
        r = random.random()
        if r < 0.15:
            done = {a["name"] for a in activities if a["participant_id"] == pid}
            nxt = next((c for c in COURSES if c not in done), None)
            if nxt:
                activities.append({"participant_id": pid, "date": d, "activity_type": "course", "name": nxt})
        elif r < 0.25:
            activities.append({"participant_id": pid, "date": d, "activity_type": "seva", "name": random.choice(SEVA)})
        else:
            activities.append({"participant_id": pid, "date": d, "activity_type": "event", "name": random.choice(EVENTS)})

OUT.mkdir(parents=True, exist_ok=True)
pd.DataFrame(participants).to_csv(OUT / "participants.csv", index=False)
pd.DataFrame(activities).to_csv(OUT / "activities.csv", index=False)
print(f"Wrote {len(participants)} participants and {len(activities)} activities to {OUT}")
