"""Learning loop: outcomes move the acceptance rates, and the moved rates change the ranking."""
import pytest

from journey_compass import config
from journey_compass.catalogue import load_catalogue
from journey_compass.data_loader import load_dataset
from journey_compass.journey import build_profiles
from journey_compass.learning import as_table, learned_rates
from journey_compass.recommender import score


def rate(rates, stage, kind):
    return next(r for r in rates if r.stage == stage and r.offer_type == kind)


def test_no_outcomes_keeps_the_prior():
    assert as_table(learned_rates([])) == config.ACCEPTANCE_PRIOR


def test_successes_raise_and_failures_lower_only_their_cell():
    up = learned_rates([{"stage": "Slipping", "offer_type": "seva", "result": "accepted"}] * 5)
    down = learned_rates([{"stage": "Slipping", "offer_type": "seva", "result": "declined"}] * 5)
    prior = config.ACCEPTANCE_PRIOR["Slipping"]["seva"]
    assert rate(up, "Slipping", "seva").rate > prior > rate(down, "Slipping", "seva").rate
    assert rate(up, "Slipping", "event").rate == config.ACCEPTANCE_PRIOR["Slipping"]["event"]
    s = config.PRIOR_STRENGTH
    assert rate(up, "Slipping", "seva").rate == pytest.approx((prior * s + 5) / (s + 5))


def test_no_response_counts_as_a_failure_and_unknown_rows_are_ignored():
    rates = learned_rates([{"stage": "New", "offer_type": "event", "result": "no_response"},
                           {"stage": None, "offer_type": "event", "result": "accepted"},
                           {"stage": "New", "offer_type": "mystery", "result": "accepted"}])
    r = rate(rates, "New", "event")
    assert (r.successes, r.trials) == (0, 1)
    assert sum(x.trials for x in rates) == 1


def test_learned_rates_shift_the_ranking(monkeypatch):
    ds = load_dataset()
    cat = load_catalogue()
    profile = next(p for p in build_profiles(ds).to_dict("records") if p["journey_stage"] == "Slipping")
    before = score(profile, cat, ds.as_of)
    seva = cat.index[cat["offer_type"] == "seva"]
    learned = learned_rates([{"stage": "Slipping", "offer_type": "seva", "result": "accepted"}] * 30)
    monkeypatch.setattr(config, "ACCEPTANCE_RATES", as_table(learned))
    after = score(profile, cat, ds.as_of)
    assert (after.loc[seva, "stage_fit"] > before.loc[seva, "stage_fit"]).all()
    assert (after.loc[seva, "score"] > before.loc[seva, "score"]).all()
