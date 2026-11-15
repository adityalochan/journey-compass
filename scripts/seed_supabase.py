#!/usr/bin/env python3
"""Seed Supabase with participants, staff, and login accounts.

Demo accounts (the first five participants and a demo coordinator) sign in with
DEMO_PASSWORD on the login page. Everyone else signs in with a magic link.
Safe to re-run: rows are upserted and existing login accounts are reused.

Usage:
  python scripts/seed_supabase.py --dry-run
  python scripts/seed_supabase.py
  python scripts/seed_supabase.py --with-programmes   # also the organisers' programme listings
"""

import argparse
import csv
import json
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    from supabase import create_client
except ImportError:
    sys.exit("Missing dependency. Run: pip install supabase python-dotenv")

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")
PARTICIPANTS_FILE = ROOT / "src" / "data" / "participants.json"
STANDING_OFFERS_FILE = ROOT / "data" / "catalogue" / "standing_offers.csv"
# The organisers' programme listings, built locally from their mock data (git-ignored).
PROGRAMMES_FILE = ROOT / "data" / "catalogue" / "programmes.csv"
# Consent fields exist only in the engine's CSV, generated alongside participants.json.
CONSENT_FILE = ROOT / "data" / "synthetic" / "participants.csv"
CONSENT_COLUMNS = ["preferred_channel", "preferred_channel_source", "email_opt_in", "whatsapp_opt_in", "do_not_contact"]

DEMO_PASSWORD = "journey-demo-2026"
DEMO_PARTICIPANT_IDS = {"p_001", "p_002", "p_003", "p_004", "p_005"}
DEMO_COORDINATOR = {"email": "anita.demo@example.org", "name": "Anita Rao", "covers": "Anita Rao"}
COORDINATOR = {"email": "tarunbjoseph@gmail.com", "name": "Tarun", "covers": "Anita Rao"}


def load_consent() -> dict:
    with open(CONSENT_FILE, encoding="utf-8", newline="") as f:
        rows = {r["participant_id"]: r for r in csv.DictReader(f)}
    as_bool = lambda v: str(v).strip().lower() in {"true", "1", "yes"}
    return {pid: {
        "preferred_channel": r.get("preferred_channel") or None,
        "preferred_channel_source": r.get("preferred_channel_source") or None,
        "email_opt_in": as_bool(r.get("email_opt_in")),
        "whatsapp_opt_in": as_bool(r.get("whatsapp_opt_in")),
        "do_not_contact": as_bool(r.get("do_not_contact")),
    } for pid, r in rows.items()}


def participant_row(p: dict, consent: dict) -> dict:
    return {
        **consent.get(p["id"], {}),
        "id": p["id"],
        "email": p["email"],
        "phone": p.get("phone") or None,
        "first_name": p["firstName"],
        "last_name": p.get("lastName"),
        "city": p.get("city"),
        "province": p.get("province"),
        "language": p.get("language") or "en",
        "assigned_to": p.get("assignedTo"),
        "joined_at": p.get("joinedAt"),
        "skills": p.get("skills", []),
        "interests": p.get("interests", []),
    }


def history_rows(p: dict) -> dict:
    pid = p["id"]
    activities = [{
        "participant_id": pid, "date": c["completedAt"], "activity_type": "course",
        "name": c["name"], "subtype": c.get("programId"), "city": c.get("city"), "source": "synthetic",
    } for c in p.get("courses", [])]
    for e in p.get("events", []):
        kind = e.get("type")
        activities.append({
            "participant_id": pid, "date": e["date"],
            "activity_type": kind if kind in ("seva", "retreat") else "event",
            "name": e["name"], "subtype": kind, "city": e.get("city"), "source": "synthetic",
        })
    contacts = [{
        "participant_id": pid, "at": c["at"], "channel": c["channel"],
        "direction": c["direction"], "summary": c.get("summary"),
    } for c in p.get("contacts", [])]
    notes = [{"participant_id": pid, "note": n, "author": p.get("assignedTo")} for n in p.get("notes", [])]
    s = p.get("signals") or {}
    signal = {
        "participant_id": pid,
        "app_opens_30d": s.get("appOpens30d", 0),
        "email_opens_30d": s.get("emailOpens30d", 0),
        "whatsapp_replies_30d": s.get("whatsappReplies30d", 0),
        "video_minutes_30d": s.get("videoMinutes30d", 0),
        "invites": p.get("invites", 0),
    }
    return {"activities": activities, "contacts": contacts, "notes": notes, "signals": [signal]}


def seed_history(client, participants: list):
    ids = [p["id"] for p in participants]
    tables = {"activities": [], "contacts": [], "notes": [], "signals": []}
    for p in participants:
        for table, rows in history_rows(p).items():
            tables[table].extend(rows)
    for table, rows in tables.items():
        client.table(table).delete().in_("participant_id", ids).execute()
        for i in range(0, len(rows), 500):
            client.table(table).insert(rows[i:i + 500]).execute()
        print(f"{table}: {len(rows)} rows")


def offer_row(o: dict) -> dict:
    split = lambda v: [x.strip() for x in (v or "").split(";") if x.strip()]
    return {
        "id": o["offer_id"],
        "offer_type": o["offer_type"],
        "name": o["name"],
        "program_key": o.get("program_key") or None,
        "commitment": int(o.get("commitment") or 2),
        "start_date": o.get("start_date") or None,
        "city": o.get("city") or None,
        "languages": split(o.get("languages")),
        "tags": split(o.get("tags")),
        "prerequisites": split(o.get("prerequisites")),
        "description": o.get("description") or None,
        "source": o.get("source") or None,
        "start_time": o.get("start_time") or None,
        "duration_min": int(float(o["duration_min"])) if o.get("duration_min") else None,
        "venue": o.get("venue") or None,
        "audience": o.get("audience") or None,
        "registration_url": o.get("registration_url") or None,
    }


def seed_offers(client, with_programmes: bool):
    files = [STANDING_OFFERS_FILE] + ([PROGRAMMES_FILE] if with_programmes else [])
    for path in files:
        if not path.exists():
            sys.exit(f"{path} not found. Build it with: python scripts/build_catalogue.py")
        with open(path, encoding="utf-8", newline="") as f:
            rows = [offer_row(o) for o in csv.DictReader(f)]
        client.table("offers").upsert(rows, on_conflict="id").execute()
        print(f"offers: {len(rows)} from {path.name}")


def existing_login_ids(client) -> dict:
    """Map lowercase email -> auth user id for every login account already created."""
    found, page = {}, 1
    while True:
        users = client.auth.admin.list_users(page=page, per_page=1000)
        if not users:
            return found
        for u in users:
            if u.email:
                found[u.email.lower()] = u.id
        page += 1


def ensure_login(client, email: str, name: str, known: dict) -> str:
    key = email.lower()
    if key not in known:
        user = client.auth.admin.create_user({
            "email": email,
            "email_confirm": True,
            "user_metadata": {"name": name},
        })
        known[key] = user.user.id
    return known[key]


def ensure_password_login(client, email: str, name: str, known: dict) -> str:
    key = email.lower()
    if key in known:
        client.auth.admin.update_user_by_id(known[key], {"password": DEMO_PASSWORD})
        return known[key]
    user = client.auth.admin.create_user({
        "email": email,
        "password": DEMO_PASSWORD,
        "email_confirm": True,
        "user_metadata": {"name": name},
    })
    known[key] = user.user.id
    return known[key]


def main(dry_run: bool, with_programmes: bool):
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")

    participants = json.loads(PARTICIPANTS_FILE.read_text(encoding="utf-8"))
    consent = load_consent()
    rows = [participant_row(p, consent) for p in participants]
    demo = [p for p in participants if p["id"] in DEMO_PARTICIPANT_IDS]
    print(f"{len(rows)} participants ({len(demo)} demo), coordinator {COORDINATOR['email']}")
    if dry_run:
        print("DRY RUN: nothing written.")
        print("Demo logins:", [p["email"] for p in demo] + [DEMO_COORDINATOR["email"]])
        return

    client = create_client(url, key)
    known = existing_login_ids(client)
    print(f"{len(known)} login accounts already exist")

    new_email = {p["id"]: p["email"].lower() for p in demo}
    old = client.table("participants").select("id,email,auth_user_id").in_("id", sorted(DEMO_PARTICIPANT_IDS)).execute().data
    for row in old:
        if row["auth_user_id"] and row["email"].lower() != new_email[row["id"]]:
            client.auth.admin.delete_user(row["auth_user_id"])
            known.pop(row["email"].lower(), None)
            print(f"Removed old login for {row['id']}")

    client.table("participants").upsert(rows, on_conflict="id").execute()
    print(f"Upserted {len(rows)} participant rows")

    for p in demo:
        ensure_password_login(client, p["email"], p["firstName"], known)
    print(f"Demo participant logins ready ({len(demo)})")

    demo_coord_id = ensure_password_login(client, DEMO_COORDINATOR["email"], DEMO_COORDINATOR["name"], known)
    client.table("staff").upsert({
        "user_id": demo_coord_id,
        "name": DEMO_COORDINATOR["name"],
        "email": DEMO_COORDINATOR["email"],
        "covers": DEMO_COORDINATOR["covers"],
    }, on_conflict="user_id").execute()

    coord_id = ensure_login(client, COORDINATOR["email"], COORDINATOR["name"], known)
    client.table("staff").upsert({
        "user_id": coord_id,
        "name": COORDINATOR["name"],
        "email": COORDINATOR["email"],
        "covers": COORDINATOR["covers"],
    }, on_conflict="user_id").execute()
    print("Staff: demo coordinator and Tarun")

    linked = 0
    for r in rows:
        uid = ensure_login(client, r["email"], r["first_name"], known)
        client.table("participants").update({"auth_user_id": uid}).eq("id", r["id"]).execute()
        linked += 1
    print(f"Linked {linked} participants to login accounts")

    seed_history(client, participants)
    seed_offers(client, with_programmes)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--with-programmes", action="store_true",
                        help="also load the organisers' programme listings (local, git-ignored)")
    args = parser.parse_args()
    main(args.dry_run, args.with_programmes)
