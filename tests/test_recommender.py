"""Step 2b: hard rules, fit score and the top 3."""
import pandas as pd
import pytest

from journey_compass import config
from journey_compass.catalogue import COLUMNS
from journey_compass.recommender import eligibility, recommend_top

AS_OF = pd.Timestamp("2026-11-14")


def offer(offer_id, offer_type="event", **kw):
    row = {c: "" for c in COLUMNS} | {"offer_id": offer_id, "offer_type": offer_type, "name": offer_id,
                                       "commitment": 1, "source": "test"} | kw
    return row


def catalogue(*rows) -> pd.DataFrame:
    cat = pd.DataFrame(list(rows))[COLUMNS]
    cat["commitment"] = cat["commitment"].astype(int)
    cat["start_date"] = pd.to_datetime(cat["start_date"].replace("", None))
    return cat


def person(**kw):
    base = {"participant_id": "x", "first_name": "X", "city": "Toronto", "language": "en",
            "course_keys": ["sky"], "journey_stage": "Active", "engagement_score": 60,
            "skills": "", "interests": "", "attended": [], "do_not_contact": False}
    return base | kw


def why(p, *rows):
    return dict(zip([r["offer_id"] for r in rows], eligibility(p, catalogue(*rows), AS_OF)))


# --- hard rules -------------------------------------------------------------------------------

def test_prerequisites_and_already_done():
    r = why(person(), offer("dsn", "course", program_key="dsn", prerequisites="part2"),
            offer("sky", "course", program_key="sky"), offer("sahaj", "course", program_key="sahaj"))
    assert r == {"dsn": "missing prerequisite part2", "sky": "already done", "sahaj": ""}


def test_yes_counts_as_sky_for_prerequisites():
    assert why(person(course_keys=["yes"]), offer("p2", "course", program_key="part2", prerequisites="sky"))["p2"] == ""


def test_audience_rules():
    r = why(person(), offer("intro", audience="newcomers"), offer("kids", audience="children"),
            offer("corp", audience="corporate"), offer("youth", audience="youth"))
    assert r == {"intro": "intro for newcomers", "kids": "for children", "corp": "for corporate", "youth": "for youth"}
    assert why(person(interests="youth"), offer("youth", audience="youth"))["youth"] == ""


def test_language_rules():
    fr_only, bilingual = offer("fr", languages="fr"), offer("both", languages="fr;en")
    assert why(person(language="en"), fr_only, bilingual) == {"fr": "language", "both": ""}
    assert why(person(language="pa"), offer("en", languages="en"))["en"] == ""          # English is open to all...
    assert why(person(language="fr"), offer("en", languages="en"))["en"] == "language"  # ...but French-only speakers


def test_location_rules():
    r = why(person(city="Brampton"), offer("tor", city="Toronto"), offer("van", city="Vancouver"),
            offer("online", city="Online"), offer("local", city=""), offer("ret", "retreat", city="Vancouver"))
    assert r == {"tor": "", "van": "not local", "online": "", "local": "", "ret": ""}


def test_timing_rules():
    r = why(person(), offer("past", start_date="2026-11-01"), offer("soon", start_date="2026-12-01"),
            offer("far", start_date="2027-09-01"), offer("always"))
    assert r == {"past": "already started", "soon": "", "far": "too far ahead", "always": ""}


# --- top 3 --------------------------------------------------------------------------------------

def test_do_not_contact_gets_nothing():
    steps = recommend_top(person(do_not_contact=True), catalogue(offer("a")), AS_OF)
    assert [s.action for s in steps] == ["none"]


def test_top3_prefers_different_kinds_of_step():
    # Three events score highest on their own; a reasonable seva role and course still make the top 3.
    cat = catalogue(offer("e1"), offer("e2"), offer("e3"), offer("s1", "seva"), offer("c1", "course"))
    steps = recommend_top(person(), cat, AS_OF)
    assert [s.offer_type for s in steps].count("event") == 1
    assert {s.offer_type for s in steps} == {"event", "seva", "course"}


def test_skills_pull_towards_a_matching_role():
    cat = catalogue(offer("kitchen", "seva", tags="cooking;seva"), offer("media", "seva", tags="photography;seva"))
    assert recommend_top(person(skills="cooking"), cat, AS_OF)[0].offer_id == "kitchen"
    assert recommend_top(person(skills="photography"), cat, AS_OF)[0].offer_id == "media"


def test_momentum_sets_the_size_of_the_ask():
    cat = catalogue(offer("drop_in", "event", commitment=1), offer("retreat", "retreat", commitment=4))
    assert recommend_top(person(journey_stage="Dormant", engagement_score=8), cat, AS_OF)[0].offer_id == "drop_in"


def test_next_course_on_the_path_wins_among_courses():
    cat = catalogue(offer("sahaj", "course", program_key="sahaj", commitment=3),
                    offer("yoga", "course", program_key="yoga", commitment=3))
    steps = recommend_top(person(), cat, AS_OF)
    assert steps[0].offer_id == "sahaj" and "next on their path" in steps[0].reason


def test_same_programme_in_two_cities_appears_once():
    cat = catalogue(offer("a", "course", program_key="sahaj", name="Sahaj (Toronto)", city="Toronto"),
                    offer("b", "course", program_key="sahaj", name="Sahaj (Mississauga)", city="Mississauga"))
    assert len(recommend_top(person(), cat, AS_OF)) == 1


# --- on the synthetic cohort --------------------------------------------------------------------

@pytest.fixture(scope="module")
def results():
    if config.DATASET != "synthetic":
        pytest.skip("pipeline checks run against the synthetic dataset only")
    from journey_compass.pipeline import run
    return run()


def test_no_longer_a_broadcast(results):
    share = results["next_item"].value_counts(normalize=True).iloc[0]
    assert share < 0.35
    assert results["next_item"].nunique() >= 10


def test_every_contactable_person_gets_three_reasons(results):
    ok = results[~results["do_not_contact"]]
    assert (ok["next_action"] != "none").all()
    for col in ("reason", "rec_2_reason", "rec_3_reason"):
        assert ok[col].str.len().gt(0).all()


def test_dormant_people_get_a_small_ask(results):
    from journey_compass.catalogue import load_catalogue
    commitment = load_catalogue().set_index("offer_id")["commitment"]
    dormant = results[results["journey_stage"] == "Dormant"]
    assert (dormant["next_offer_id"].map(commitment) <= 2).all()
