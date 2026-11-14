"""Contract tests: the synthetic dataset's shape, and the hard rules (consent, stated preference)."""
import pandas as pd
import pytest

from journey_compass import config
from journey_compass.channel import STATED, suggest_channel
from journey_compass.messaging import draft_message
from journey_compass.recommender import recommend

SYNTHETIC = config.ROOT / "data" / "synthetic"
SAMPLE = config.ROOT / "data" / "sample"
SKY = "Art of Living Part 1 (SKY)"


def profile(**overrides):
    base = {"courses_taken": [SKY], "num_courses": 1, "num_events": 1, "num_seva": 0,
            "days_since_last": 10, "stage": "Active", "last_activity": "Satsang",
            "first_name": "Test", "city": "Toronto"}
    return {**base, **overrides}


# --- data shape -------------------------------------------------------------------------------

@pytest.mark.parametrize("name", ["participants", "activities"])
def test_synthetic_csv_starts_with_the_sample_columns(name):
    sample = list(pd.read_csv(SAMPLE / f"{name}.csv", nrows=0).columns)
    synthetic = list(pd.read_csv(SYNTHETIC / f"{name}.csv", nrows=0).columns)
    assert synthetic[:len(sample)] == sample


def test_generator_answer_key_is_not_exported():
    columns = set(pd.read_csv(SYNTHETIC / "participants.csv", nrows=0).columns)
    assert not {"archetype", "hero"} & columns


# --- hard rules, unit level -------------------------------------------------------------------

def test_do_not_contact_beats_every_other_rule():
    step = recommend(profile(do_not_contact=True, stage="Dormant", days_since_last=400))
    assert step.action == "none"
    assert suggest_channel(profile(do_not_contact=True), step.action) == ""
    assert draft_message(profile(do_not_contact=True), step, "") == ""


def test_missing_do_not_contact_value_is_not_treated_as_true():
    assert recommend(profile(do_not_contact=float("nan"))).action != "none"


def test_stated_preference_overrides_inference():
    dormant = profile(stage="Dormant", days_since_last=400, preferred_channel="email",
                      preferred_channel_source="stated", email_opt_in=True)
    assert suggest_channel(dormant, "re_engage") == "Email"  # not the 180-day phone-call rule

    phone = profile(preferred_channel="phone", preferred_channel_source="stated",
                    whatsapp_opt_in=True, email_opt_in=True)
    assert suggest_channel(phone, "follow_on_course") == "Phone call (volunteer)"


def test_inferred_preference_does_not_get_the_override():
    inferred = profile(preferred_channel="phone", preferred_channel_source="inferred", email_opt_in=True)
    assert suggest_channel(inferred, "follow_on_course") == "Email"


# --- whole pipeline on the synthetic cohort ---------------------------------------------------

@pytest.fixture(scope="module")
def results():
    if config.DATASET != "synthetic":
        pytest.skip("pipeline checks run against the synthetic dataset only")
    from journey_compass.pipeline import run
    return run()


def test_every_participant_gets_a_row(results):
    assert len(results) == 180
    assert results["participant_id"].is_unique


def test_do_not_contact_people_get_nothing(results):
    dnc = results[results["do_not_contact"]]
    assert len(dnc) == 3
    assert (dnc["next_action"] == "none").all()
    assert (dnc["channel"] == "").all()


def test_every_stated_preference_is_honoured(results):
    stated = results[(results["preferred_channel_source"] == "stated") & ~results["do_not_contact"]]
    assert len(stated) > 0
    assert (stated["channel"] == stated["preferred_channel"].map(STATED)).all()
