"""Step 3b: the message writer and its checks, with a fake LLM (no network, no key)."""
import pandas as pd
import pytest

from journey_compass import llm, messaging
from journey_compass.recommender import NextStep

FAKE = llm.Provider("groq", "https://example.invalid", "fake-model", "k", 0, local=False)
STEP = NextStep("seva", "Kitchen seva at your local centre", "", offer_id="seva_kitchen",
                offer_type="seva", when="any time", where="local centre")
DATED = NextStep("course", "Sahaj Samadhi Meditation", "", offer_id="hm_x", offer_type="course",
                 when="2027-01-02", where="Montreal")
PRIYA = {"first_name": "Priya", "language": "en",
         "notes": "Started a new job in September — evenings are her only free time."}
MARC = {"first_name": "Marc", "language": "fr", "notes": ""}


def fake_llm(monkeypatch, *answers):
    replies = list(answers)
    calls = []

    def chat(system, user, as_json=False, temperature=0.2):
        calls.append(user)
        return replies.pop(0), {"cached": False, "model": "fake-model"}

    monkeypatch.setattr(llm, "provider", lambda: FAKE)
    monkeypatch.setattr(llm, "chat", chat)
    return calls


GOOD = "Hi Priya, we'd love you to join the kitchen seva at your local centre whenever it suits you. Your Art of Living team"


# --- checks -----------------------------------------------------------------------------------

def test_clean_message_passes():
    assert messaging.check(GOOD, PRIYA, STEP, "WhatsApp") == []


def test_echoing_a_note_is_caught():
    leaked = "Hi Priya, since evenings are her only free time, join the kitchen seva. Your Art of Living team"
    assert "repeats wording from their notes or contact history" in messaging.check(leaked, PRIYA, STEP, "WhatsApp")
    told = "Hi Priya, you mentioned your new job, so come to kitchen seva. Your Art of Living team"
    assert any("mentioned" in p for p in messaging.check(told, PRIYA, STEP, "WhatsApp"))


def test_contact_summaries_count_as_private():
    contacts = pd.DataFrame({"summary": ["Said she wants to serve more but not another course"]})
    text = "Hi Priya, we know you want to serve more but not another course. Your Art of Living team"
    assert messaging.check(text, PRIYA, STEP, "WhatsApp", contacts)


def test_length_subject_language_and_dates():
    long = "Hi Priya, " + "lovely " * 70 + "Your Art of Living team"
    assert any("too long" in p for p in messaging.check(long, PRIYA, STEP, "WhatsApp"))
    assert "email has no subject line" in messaging.check(GOOD, PRIYA, STEP, "Email")
    assert "not written in French" in messaging.check(GOOD, MARC, STEP, "WhatsApp")
    invented = "Hi Priya, join the kitchen seva on March 3 at your centre. Your Art of Living team"
    assert any("month" in p for p in messaging.check(invented, PRIYA, STEP, "WhatsApp"))
    ok_month = "Bonjour Marc, nous vous proposons la méditation Sahaj le samedi 2 janvier à Montréal. Votre équipe Art of Living"
    assert messaging.check(ok_month, MARC, DATED, "WhatsApp") == []


def test_placeholders_and_wrong_subject_prefix_are_caught():
    assert any("placeholder" in p for p in messaging.check(
        "Hi Priya, this is [Your Name] from Art of Living, join us for kitchen seva.", PRIYA, STEP, "Phone call (volunteer)"))
    french_prefix = "Objet : Kitchen seva\n\nHi Priya, join the kitchen seva at your centre. Your Art of Living team"
    assert any("should start with 'Subject:'" in p for p in messaging.check(french_prefix, PRIYA, STEP, "Email"))
    assert any("no subject line" in p for p in messaging.check("Subject: Hi\n\n" + GOOD, PRIYA, STEP, "WhatsApp"))


def test_phone_brief_names_the_volunteer(monkeypatch):
    calls = fake_llm(monkeypatch, "Hi Priya, it's Anita from Art of Living. Would you like to join the kitchen seva?")
    messaging.draft(PRIYA | {"assigned_to": "Anita Rao"}, STEP, "Phone call (volunteer)")
    assert "Volunteer's name: Anita" in calls[0]


# --- drafting ---------------------------------------------------------------------------------

def test_good_draft_is_used(monkeypatch):
    fake_llm(monkeypatch, GOOD)
    d = messaging.draft(PRIYA, STEP, "WhatsApp")
    assert d.source == "llm" and d.text == GOOD


def test_bad_draft_is_retried_with_the_problems_then_template(monkeypatch):
    bad = "Hi Priya, you mentioned evenings are her only free time. Your Art of Living team"
    calls = fake_llm(monkeypatch, bad, bad)
    d = messaging.draft(PRIYA, STEP, "WhatsApp")
    assert len(calls) == 2 and "problems" in calls[1]
    assert d.source == "template" and d.problems and "evenings" not in d.text


def test_retry_can_succeed(monkeypatch):
    fake_llm(monkeypatch, "Hi Priya, you mentioned you like cooking. Your Art of Living team", GOOD)
    assert messaging.draft(PRIYA, STEP, "WhatsApp").source == "llm"


def test_the_writer_never_sees_notes(monkeypatch):
    calls = fake_llm(monkeypatch, GOOD)
    messaging.draft(PRIYA, STEP, "WhatsApp", angle="a simple way to give back")
    assert "evenings" not in calls[0] and "new job" not in calls[0]
    assert "a simple way to give back" in calls[0]


def test_no_provider_or_failure_gives_the_template(monkeypatch):
    monkeypatch.setattr(llm, "provider", lambda: None)
    assert messaging.draft(PRIYA, STEP, "Email").source == "template"

    def down(*a, **k):
        raise llm.LLMUnavailable("groq HTTP 429")
    monkeypatch.setattr(llm, "provider", lambda: FAKE)
    monkeypatch.setattr(llm, "chat", down)
    d = messaging.draft(PRIYA, STEP, "Email")
    assert d.source == "template" and "429" in d.problems[0]


@pytest.mark.parametrize("channel", ["WhatsApp", "Email", "Phone call (volunteer)"])
@pytest.mark.parametrize("person,step", [(PRIYA, STEP), (MARC, DATED)])
def test_templates_pass_their_own_checks(person, step, channel):
    text = messaging.template_message(person, step, channel, angle="")
    assert messaging.check(text, person, step, channel) == []


def test_do_not_contact_gets_nothing(monkeypatch):
    fake_llm(monkeypatch, GOOD)
    none = NextStep("none", "", "Asked not to be contacted.")
    assert messaging.draft(PRIYA, none, "").text == ""
