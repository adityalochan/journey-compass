"""Features for one point in time: the decaying engagement score, its trend, the projected drift
date and the behavioural counts the learned models read.

Everything is computed "as of" a date and ignores anything after it, so the same code gives
today's picture, the picture 60 days ago (for the trend), or any point in the past.
"""
import numpy as np
import pandas as pd

from . import config
from .data_loader import Dataset

CAP_DAYS = 1500  # "never" / very long ago

# Feature groups. A model trained on a group can only be used on data that has that source.
# Deliberately left out of the stage model (still computed, still in the score): number of
# courses, number of retreats and invitations received. In the synthetic data they correlate
# with stage only because of how the generator built each archetype; for a real person, more
# courses or more invitations is not a sign of drifting.
FEATURE_GROUPS = {
    "core": ["log_days_since_activity", "log_tenure_capped", "is_new_window", "engagement",
             "engagement_prev", "trend", "has_deep_course", "log_events_90",
             "log_events_365", "log_seva_365", "log_seva_total", "log_acts_90"],
    "contacts": ["log_days_since_contact", "log_days_since_inbound", "log_inbound_180",
                 "unanswered_out"],
    "signals": ["log_app_opens", "log_email_opens", "log_wa_replies", "log_video_minutes"],
}


def _touchpoints(ds: Dataset, use_contacts: bool) -> pd.DataFrame:
    tp = ds.activities[["participant_id", "date", "kind"]]
    if use_contacts and len(ds.contacts):
        c = ds.contacts[["participant_id", "date", "direction"]].copy()
        c["kind"] = np.where(c["direction"] == "in", "contact_in", "contact_out")
        tp = pd.concat([tp, c[["participant_id", "date", "kind"]]], ignore_index=True)
    return tp


def _decayed_points(tp: pd.DataFrame, as_of: pd.Timestamp) -> pd.DataFrame:
    """Points per participant per touchpoint kind, faded to `as_of`. Wide frame, one column per kind."""
    tp = tp[tp["date"] <= as_of]
    age = (as_of - tp["date"]).dt.days.to_numpy()
    pts = np.array([config.TOUCHPOINT_POINTS[k][0] for k in tp["kind"]])
    half = np.array([config.TOUCHPOINT_POINTS[k][1] for k in tp["kind"]])
    tp = tp.assign(points=pts * 0.5 ** (age / half))
    wide = tp.pivot_table(index="participant_id", columns="kind", values="points", aggfunc="sum", fill_value=0.0)
    for k in config.TOUCHPOINT_POINTS:
        if k not in wide:
            wide[k] = 0.0
    return wide[list(config.TOUCHPOINT_POINTS)]


def to_engagement(points) -> np.ndarray:
    return 100.0 * (1.0 - np.exp(-np.asarray(points, dtype=float) / config.ENGAGEMENT_SCALE))


def signal_points(participants: pd.DataFrame) -> pd.Series:
    total = pd.Series(0.0, index=participants["participant_id"])
    for col, w in config.SIGNAL_POINTS.items():
        if col in participants:
            total += w * participants.set_index("participant_id")[col].astype(float)
    return total


def _days_to_drift(components: pd.DataFrame, sig: pd.Series) -> np.ndarray:
    """Days until the score fades below DRIFT_THRESHOLD if nothing new happens."""
    t = np.arange(0, 731)
    kinds = list(config.TOUCHPOINT_POINTS)
    S = components[kinds].to_numpy()                               # persons x kinds
    H = np.array([config.TOUCHPOINT_POINTS[k][1] for k in kinds])  # kinds
    R = S @ (0.5 ** (t[None, :] / H[:, None]))                     # persons x days
    R += sig.reindex(components.index).fillna(0).to_numpy()[:, None] * 0.5 ** (t[None, :] / config.SIGNAL_HALF_LIFE)
    below = to_engagement(R) < config.DRIFT_THRESHOLD
    first = np.where(below.any(axis=1), below.argmax(axis=1), 731)
    return first


def compute_features(ds: Dataset, as_of: pd.Timestamp | None = None, use_contacts: bool | None = None,
                     use_signals: bool | None = None) -> pd.DataFrame:
    """One row per participant with everything known as of `as_of` (default: the dataset's today)."""
    now = as_of is None or as_of == ds.as_of
    as_of = ds.as_of if as_of is None else as_of
    use_contacts = ("contacts" in ds.sources) if use_contacts is None else use_contacts
    use_signals = (("signals" in ds.sources) and now) if use_signals is None else use_signals

    pids = ds.participants["participant_id"]
    acts = ds.activities[ds.activities["date"] <= as_of]
    f = pd.DataFrame(index=pd.Index(pids, name="participant_id"))

    tp = _touchpoints(ds, use_contacts)
    comp = _decayed_points(tp, as_of).reindex(f.index, fill_value=0.0)
    comp_prev = _decayed_points(tp, as_of - pd.Timedelta(days=config.TREND_WINDOW_DAYS)).reindex(f.index, fill_value=0.0)
    sig = signal_points(ds.participants) if use_signals else pd.Series(0.0, index=f.index)
    sig = sig.reindex(f.index).fillna(0.0)

    for k in config.TOUCHPOINT_POINTS:
        f[f"pts_{k}"] = comp[k]
    f["pts_signals"] = sig
    f["raw_points"] = comp.sum(axis=1) + sig
    f["engagement"] = to_engagement(f["raw_points"])
    # Signals are a 30-day snapshot, so the "60 days ago" score has none: trend reflects behaviour.
    f["engagement_prev"] = to_engagement(comp_prev.sum(axis=1))
    f["trend"] = to_engagement(comp.sum(axis=1)) - f["engagement_prev"]
    f["days_to_drift"] = _days_to_drift(comp, sig)

    g = acts.groupby("participant_id")
    age = (as_of - acts["date"]).dt.days
    last = g["date"].max().reindex(f.index)
    first = g["date"].min().reindex(f.index)
    f["last_activity_date"] = last
    f["first_activity_date"] = first
    f["days_since_activity"] = (as_of - last).dt.days.fillna(CAP_DAYS).clip(upper=CAP_DAYS)
    f["tenure"] = (as_of - first).dt.days.fillna(0)

    def count(mask):
        return acts[mask].groupby("participant_id").size().reindex(f.index, fill_value=0)

    f["n_courses"] = count(acts["kind"] == "course")
    f["has_deep_course"] = count((acts["kind"] == "course") & acts["course_key"].isin(config.DEEP_COURSES)).gt(0).astype(float)
    f["n_events_90"] = count((acts["kind"] == "event") & (age <= 90))
    f["n_events_365"] = count((acts["kind"] == "event") & (age <= 365))
    f["n_seva_365"] = count((acts["kind"] == "seva") & (age <= 365))
    f["n_seva_total"] = count(acts["kind"] == "seva")
    f["n_retreats"] = count(acts["kind"] == "retreat")
    f["n_events_total"] = count(acts["kind"] == "event")
    f["acts_90"] = count(age <= 90)

    if use_contacts and len(ds.contacts):
        c = ds.contacts[ds.contacts["date"] <= as_of]
        cg = c.groupby("participant_id")["date"]
        inbound = c[c["direction"] == "in"]
        last_c = cg.max().reindex(f.index)
        last_in = inbound.groupby("participant_id")["date"].max().reindex(f.index)
        f["days_since_contact"] = (as_of - last_c).dt.days.fillna(CAP_DAYS)
        f["days_since_inbound"] = (as_of - last_in).dt.days.fillna(CAP_DAYS)
        f["inbound_180"] = inbound[(as_of - inbound["date"]).dt.days <= 180].groupby("participant_id").size().reindex(f.index, fill_value=0)
        out_after = c.merge(last_in.rename("last_in").reset_index(), on="participant_id", how="left")
        out_after = out_after[(out_after["direction"] == "out")
                              & (out_after["last_in"].isna() | (out_after["date"] > out_after["last_in"]))]
        f["unanswered_out"] = out_after.groupby("participant_id").size().reindex(f.index, fill_value=0)
    else:
        f["days_since_contact"] = f["days_since_activity"]
        f["days_since_inbound"] = f["days_since_activity"]
        f["inbound_180"] = 0
        f["unanswered_out"] = 0

    # Model inputs: logs tame long tails. Tenure is capped so that "joined long ago" cannot be
    # learned as a sign of drifting; it only tells "new" apart from everyone else.
    f["log_days_since_activity"] = np.log1p(f["days_since_activity"])
    f["log_tenure_capped"] = np.log1p(f["tenure"].clip(upper=180))
    f["is_new_window"] = ((f["tenure"] <= config.NEW_WINDOW_DAYS) & f["first_activity_date"].notna()).astype(float)
    f["engagement"] = f["engagement"] / 100.0
    f["engagement_prev"] = f["engagement_prev"] / 100.0
    f["trend"] = f["trend"] / 100.0
    for src, dst in [("n_events_90", "log_events_90"), ("n_events_365", "log_events_365"),
                     ("n_seva_365", "log_seva_365"), ("n_seva_total", "log_seva_total"),
                     ("n_retreats", "log_retreats"), ("acts_90", "log_acts_90"),
                     ("days_since_contact", "log_days_since_contact"),
                     ("days_since_inbound", "log_days_since_inbound"), ("inbound_180", "log_inbound_180")]:
        f[dst] = np.log1p(f[src])
    f["has_deep_course"] = f["has_deep_course"].astype(float)
    f["engagement_score"] = (f["engagement"] * 100).round(1)   # 0..100, for people to read
    f["engagement_prev_score"] = (f["engagement_prev"] * 100).round(1)
    f["trend_points"] = (f["trend"] * 100).round(1)

    p =ds.participants.set_index("participant_id").reindex(f.index)
    for col, dst in [("app_opens_30d", "log_app_opens"), ("email_opens_30d", "log_email_opens"),
                     ("whatsapp_replies_30d", "log_wa_replies"), ("video_minutes_30d", "log_video_minutes"),
                     ("invites", "log_invites")]:
        raw = p[col].astype(float) if (use_signals and col in p) else pd.Series(0.0, index=f.index)
        f[col] = raw
        f[dst] = np.log1p(raw)
    return f


def available_groups(ds: Dataset) -> list[str]:
    groups = ["core"]
    if "contacts" in ds.sources:
        groups.append("contacts")
    if "signals" in ds.sources:
        groups.append("signals")
    return groups


def feature_columns(groups: list[str]) -> list[str]:
    return [c for g in groups for c in FEATURE_GROUPS[g]]


def engagement_breakdown(row: pd.Series) -> str:
    """Human-readable "why this score", e.g. 'courses 6.1 pts, events 2.0 pts, replies 1.2 pts'."""
    labels = {"course": "courses", "retreat": "retreats", "seva": "seva", "event": "events",
              "contact_in": "their messages", "contact_out": "our outreach", "signals": "app/email/video"}
    parts = [(labels[k], row.get(f"pts_{k}", 0.0)) for k in list(config.TOUCHPOINT_POINTS) + ["signals"]]
    parts = [(n, v) for n, v in parts if v >= 0.1]
    parts.sort(key=lambda x: -x[1])
    return ", ".join(f"{n} {v:.1f} pts" for n, v in parts) or "no recent touchpoints"
