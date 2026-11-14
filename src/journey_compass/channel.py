"""Suggest how to reach the person."""


def suggest_channel(profile: dict, action: str) -> str:
    # Long-quiet people get a human touch; a message from a volunteer lands better than a broadcast.
    if action == "re_engage" and profile["days_since_last"] > 180:
        return "Phone call (volunteer)"
    if profile.get("preferred_channel") == "whatsapp" and profile.get("whatsapp_opt_in"):
        return "WhatsApp"
    if profile.get("email_opt_in"):
        return "Email"
    return "SMS"
