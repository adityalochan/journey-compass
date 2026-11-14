"""Suggest how to reach the person."""

STATED = {"email": "Email", "whatsapp": "WhatsApp", "phone": "Phone call (volunteer)"}


def suggest_channel(profile: dict, action: str) -> str:
    if action == "none":
        return ""
    # Someone who has told us how they want to be reached is reached that way. No inference overrides it.
    if profile.get("preferred_channel_source") == "stated" and profile.get("preferred_channel") in STATED:
        return STATED[profile["preferred_channel"]]
    # Long-quiet people get a human touch; a message from a volunteer lands better than a broadcast.
    if action == "re_engage" and profile["days_since_last"] > 180:
        return "Phone call (volunteer)"
    if profile.get("preferred_channel") == "whatsapp" and profile.get("whatsapp_opt_in"):
        return "WhatsApp"
    if profile.get("email_opt_in"):
        return "Email"
    return "SMS"
