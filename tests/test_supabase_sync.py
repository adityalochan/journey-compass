"""Offline checks for the Supabase loader: rows shaped like Supabase's become the engine's inputs."""
import pandas as pd

from journey_compass.catalogue import COLUMNS
from journey_compass.supabase_sync import offers_frame, participants_frame


def test_participants_frame_joins_lists_notes_and_signals():
    people = [{"id": "p_1", "first_name": "Priya", "skills": ["cooking", "music"], "interests": ["seva"],
               "email_opt_in": True, "whatsapp_opt_in": False, "do_not_contact": False}]
    signals = [{"participant_id": "p_1", "app_opens_30d": 3, "email_opens_30d": 1,
                "whatsapp_replies_30d": 0, "video_minutes_30d": 18, "invites": 2}]
    notes = [{"participant_id": "p_1", "note": "first"}, {"participant_id": "p_1", "note": "second"}]
    row = participants_frame(people, signals, notes).iloc[0]
    assert row["skills"] == "cooking; music"
    assert row["notes"] == "first | second"
    assert row["app_opens_30d"] == 3 and row["invites"] == 2
    assert bool(row["email_opt_in"]) and not bool(row["do_not_contact"])


def test_participant_without_signals_or_notes_gets_zeros_and_blank():
    row = participants_frame([{"id": "p_2", "first_name": "Wei"}], [], []).iloc[0]
    assert row["notes"] == "" and row["video_minutes_30d"] == 0


def test_offers_frame_matches_catalogue_shape():
    offers = [
        {"id": "seva_kitchen", "offer_type": "seva", "name": "Kitchen seva", "commitment": 2,
         "tags": ["cooking", "seva"], "languages": [], "prerequisites": [], "active": True},
        {"id": "ev_1", "offer_type": "event", "name": "Satsang", "commitment": 1, "start_date": "2027-02-11",
         "start_time": "09:30:00", "duration_min": 60, "city": "Online", "active": True},
        {"id": "old", "offer_type": "event", "name": "Retired", "commitment": 1, "active": False},
    ]
    cat = offers_frame(offers)
    assert list(cat.columns) == COLUMNS
    assert list(cat["offer_id"]) == ["seva_kitchen", "ev_1"]
    assert cat.loc[0, "tags"] == "cooking;seva" and pd.isna(cat.loc[0, "start_date"])
    assert cat.loc[1, "start_time"] == "09:30" and cat.loc[1, "start_date"] == pd.Timestamp("2027-02-11")
