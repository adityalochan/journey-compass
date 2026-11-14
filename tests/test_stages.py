"""Step 1: engagement score, trend, drift date and the learned stage model."""
import pandas as pd
import pytest

from journey_compass import config
from journey_compass.data_loader import Dataset, load_dataset, prepare_activities, prepare_contacts, prepare_participants
from journey_compass.features import compute_features
from journey_compass.journey import build_profiles
from journey_compass.models import load
from journey_compass.stage_model import assign_stages, synthetic_labels

AS_OF = pd.Timestamp("2026-11-14")


def tiny(activities: list[tuple], contacts: list[tuple] | None = None) -> Dataset:
    """A one-person dataset: activities as (date, activity_type, name)."""
    people = prepare_participants(pd.DataFrame([{"participant_id": "x", "first_name": "X", "city": "Toronto",
                                                 "preferred_channel": "email", "email_opt_in": True,
                                                 "whatsapp_opt_in": False}]))
    acts = prepare_activities(pd.DataFrame([{"participant_id": "x", "date": d, "activity_type": t, "name": n}
                                            for d, t, n in activities]))
    cons = prepare_contacts(pd.DataFrame([{"participant_id": "x", "at": d, "channel": "email", "direction": dr,
                                           "summary": ""} for d, dr in (contacts or [])]))
    return Dataset(people, acts, cons, AS_OF, name="tiny", sources={"contacts"} if contacts else set())


# --- the score --------------------------------------------------------------------------------

def test_a_course_fades_by_half_over_its_half_life():
    points, half_life = config.TOUCHPOINT_POINTS["course"]
    today = compute_features(tiny([("2026-11-14", "course", "Art of Living Part 1 (SKY)")]))
    later = compute_features(tiny([((AS_OF - pd.Timedelta(days=half_life)).date(), "course", "SKY")]))
    assert today.loc["x", "pts_course"] == pytest.approx(points)
    assert later.loc["x", "pts_course"] == pytest.approx(points / 2)


def test_anything_after_as_of_is_ignored():
    f = compute_features(tiny([("2026-01-10", "course", "SKY"), ("2026-12-01", "event", "Satsang")]))
    assert f.loc["x", "n_events_365"] == 0
    assert f.loc["x", "days_since_activity"] == (AS_OF - pd.Timestamp("2026-01-10")).days


def test_drift_date_is_later_for_more_recent_activity():
    recent = compute_features(tiny([("2026-11-01", "course", "SKY")]))
    older = compute_features(tiny([("2026-09-01", "course", "SKY")]))
    assert recent.loc["x", "days_to_drift"] > older.loc["x", "days_to_drift"] > 0
    nothing = compute_features(tiny([("2023-01-01", "event", "Satsang")]))
    assert nothing.loc["x", "days_to_drift"] == 0   # already below the drift line


def test_their_reply_counts_more_than_our_message():
    theirs = compute_features(tiny([("2026-01-01", "course", "SKY")], [("2026-11-10T10:00:00-05:00", "in")]))
    ours = compute_features(tiny([("2026-01-01", "course", "SKY")], [("2026-11-10T10:00:00-05:00", "out")]))
    assert theirs.loc["x", "engagement_score"] > ours.loc["x", "engagement_score"]


# --- on the synthetic cohort -----------------------------------------------------------------

@pytest.fixture(scope="module")
def synthetic():
    ds = load_dataset(config.ROOT / "data" / "synthetic")
    return ds, compute_features(ds).join(synthetic_labels())


def test_score_orders_the_stages(synthetic):
    _, f = synthetic
    med = f.groupby("label")["engagement_score"].median()
    assert med["Active"] > med["Slipping"] > med["Drifting"] > med["Dormant"]
    assert med["Dormant"] < config.DRIFT_THRESHOLD < med["Slipping"]


def test_answer_key_is_never_an_input(synthetic):
    _, f = synthetic
    for model in load(config.STAGE_MODEL_FILE).values():
        assert not {"label", "archetype", "hero"} & set(model.features)
    assert "archetype" not in pd.read_csv(config.ROOT / "data" / "synthetic" / "participants.csv", nrows=0)


def test_committed_model_beats_the_rule_baseline():
    models = load(config.STAGE_MODEL_FILE)
    assert set(models) == {"stage_full", "stage_core"}
    for m in models.values():
        assert m.meta["cv_accuracy"] >= 0.85
        assert m.meta["cv_accuracy"] > m.meta["rule_baseline_accuracy"]


def test_behaviour_only_model_is_used_when_contacts_and_signals_are_missing():
    ds = tiny([("2026-10-01", "course", "SKY")])
    out = assign_stages(ds, compute_features(ds))
    assert out.loc["x", "stage_model"] == "learned: core"


def test_rule_fallback_when_there_is_no_model():
    ds = tiny([("2026-11-01", "course", "SKY")])
    out = assign_stages(ds, compute_features(ds), models={})
    assert out.loc["x", "stage_model"].startswith("rule")
    assert out.loc["x", "journey_stage"] == "New"


# --- what the pipeline hands to the dashboard -------------------------------------------------

@pytest.mark.parametrize("dataset", ["synthetic", "sample"])
def test_profiles_carry_both_stage_columns(dataset):
    profiles = build_profiles(load_dataset(config.ROOT / "data" / dataset))
    assert profiles["journey_stage"].isin(config.STAGES).all()
    assert (profiles["stage"] == profiles["journey_stage"].map(config.SIMPLE_STAGE)).all()
    assert profiles["stage_drivers"].str.len().gt(0).all()
    assert profiles["engagement_score"].between(0, 100).all()
