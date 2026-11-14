"""Next-step prediction. Rule-based to start; each rule returns a human-readable reason."""
from dataclasses import dataclass

from . import config


@dataclass
class NextStep:
    action: str   # follow_on_course | retreat | seva | re_engage
    item: str     # what specifically to offer
    reason: str   # why, shown to coordinators and judges


def next_course(courses_taken: list[str]) -> str | None:
    return next((c for c in config.COURSE_PATH if c not in courses_taken), None)


def recommend(profile: dict) -> NextStep:
    courses = profile["courses_taken"]
    days = profile["days_since_last"]

    if profile["stage"] == "Dormant":
        return NextStep("re_engage", "Free online group SKY follow-up",
                        f"No contact in {days} days; last activity was '{profile['last_activity']}'.")

    if profile["num_events"] >= config.SEVA_MIN_EVENTS and profile["num_seva"] == 0:
        return NextStep("seva", "Volunteer at the next local intro session",
                        f"Attended {profile['num_events']} events but hasn't tried seva yet.")

    if profile["num_courses"] >= config.RETREAT_MIN_COURSES:
        nxt = next_course(courses)
        if nxt and "Retreat" in nxt:
            return NextStep("retreat", nxt,
                            f"Completed {profile['num_courses']} courses; ready to go deeper.")

    nxt = next_course(courses)
    if nxt:
        return NextStep("follow_on_course", nxt,
                        f"Has done {', '.join(courses) or 'no courses'}; '{nxt}' is the natural next step.")

    return NextStep("seva", "Mentor new SKY participants",
                    "Has completed the full course path; can support others.")
