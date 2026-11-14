from journey_compass.recommender import recommend

SKY = "Art of Living Part 1 (SKY)"


def profile(**overrides):
    base = {"courses_taken": [SKY], "num_courses": 1, "num_events": 1, "num_seva": 0,
            "days_since_last": 10, "stage": "Active", "last_activity": "Satsang"}
    return {**base, **overrides}


def test_dormant_gets_re_engagement():
    assert recommend(profile(stage="Dormant", days_since_last=200)).action == "re_engage"


def test_frequent_attendee_gets_seva():
    assert recommend(profile(num_events=6)).action == "seva"


def test_new_sky_grad_gets_follow_on_course():
    step = recommend(profile())
    assert step.action == "follow_on_course"
    assert step.item == "Sahaj Samadhi Meditation"
