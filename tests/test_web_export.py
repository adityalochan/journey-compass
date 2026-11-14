"""What the participant website receives: right shape, and nothing internal."""
import json

import pytest

from journey_compass import config, web_export

WEB_KINDS = {"course", "retreat", "seva", "event", "call"}
WEB_STAGES = {"new", "practicing", "slipping", "drifting", "dormant"}


@pytest.fixture(scope="module")
def out():
    if config.DATASET != "synthetic":
        pytest.skip("the website shows the synthetic cohort")
    return web_export.build()


def test_every_website_participant_is_covered(out):
    cohort = json.loads(config.COHORT_FILE.read_text(encoding="utf-8"))
    assert {p["id"] for p in cohort} == set(out["participants"])


def test_shape_matches_the_website_types(out):
    for person in out["participants"].values():
        assert person["stage"] in WEB_STAGES
        assert len(person["next_steps"]) <= 3
        for step in person["next_steps"]:
            assert {"offer_id", "name", "kind", "when", "why", "online"} <= set(step)
            assert set(step) <= {"offer_id", "name", "kind", "when", "why", "online", "start", "durationMin"}
            assert step["kind"] in WEB_KINDS
            assert step["name"] and step["when"] and step["why"]


def test_do_not_contact_people_get_no_steps(out):
    cohort = json.loads(config.COHORT_FILE.read_text(encoding="utf-8"))
    for p in cohort:
        if p.get("doNotContact"):
            assert out["participants"][p["id"]]["next_steps"] == []


def test_nothing_internal_reaches_the_website(out):
    text = json.dumps(out).lower()
    cohort = json.loads(config.COHORT_FILE.read_text(encoding="utf-8"))
    for p in cohort:   # no volunteer note or contact summary appears anywhere
        for note in p["notes"] + [c["summary"] for c in p["contacts"]]:
            assert note.lower() not in text
    # no stage words, scores or coordinator phrasing in what participants read
    whys = " ".join(s["why"].lower() for v in out["participants"].values() for s in v["next_steps"])
    for word in ("slipping", "drifting", "dormant", "engagement", "score", "suits someone", "momentum"):
        assert word not in whys
