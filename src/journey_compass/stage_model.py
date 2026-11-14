"""Where is each person on their journey? New / Active / Slipping / Drifting / Dormant.

How it works
  1. features.py describes each person with ~14-23 numbers (score, trend, recency, counts...).
  2. A classifier (models.SoftmaxModel, multinomial logistic regression) has learned one weight
     per number per stage from the 180 synthetic people, whose true stage the generator recorded.
  3. For a new person it adds up weight x number for each stage and picks the most likely one,
     and reports which numbers pushed hardest towards that stage.

Two variants are trained, because not every dataset has every source:
  full - behaviour + contact log + app/email/video signals (synthetic-style data)
  core - behaviour only (courses, events, seva, retreats): works on any dataset

At run time the richest variant the dataset can feed is used. With no model file at all, a
transparent score-based rule is used instead; it is also the baseline the model is compared with.
"""
import json

import numpy as np
import pandas as pd

from . import config
from .data_loader import Dataset
from .features import available_groups, feature_columns
from .models import SoftmaxModel, load, save

VARIANTS = {"full": ["core", "contacts", "signals"], "core": ["core"]}

# feature -> (how to say it, raw column to show, format). None as column = yes/no feature.
READABLE = {
    "log_days_since_activity": ("days since last activity", "days_since_activity", "{:.0f}"),
    "log_days_since_contact": ("days since last contact", "days_since_contact", "{:.0f}"),
    "log_days_since_inbound": ("days since they last reached out", "days_since_inbound", "{:.0f}"),
    "log_tenure_capped": ("days since first course", "tenure", "{:.0f}"),
    "engagement": ("engagement score", "engagement_score", "{:.0f}/100"),
    "engagement_prev": ("score 60 days ago", "engagement_prev_score", "{:.0f}/100"),
    "trend": ("60-day trend", "trend_points", "{:+.0f}"),
    "n_courses": ("courses taken", "n_courses", "{:.0f}"),
    "log_events_90": ("events in last 90 days", "n_events_90", "{:.0f}"),
    "log_events_365": ("events in last year", "n_events_365", "{:.0f}"),
    "log_seva_365": ("seva in last year", "n_seva_365", "{:.0f}"),
    "log_seva_total": ("seva overall", "n_seva_total", "{:.0f}"),
    "log_retreats": ("retreats", "n_retreats", "{:.0f}"),
    "log_acts_90": ("touchpoints in last 90 days", "acts_90", "{:.0f}"),
    "log_inbound_180": ("replies in last 180 days", "inbound_180", "{:.0f}"),
    "unanswered_out": ("our messages since their last reply", "unanswered_out", "{:.0f}"),
    "log_app_opens": ("app opens (30 days)", "app_opens_30d", "{:.0f}"),
    "log_email_opens": ("email opens (30 days)", "email_opens_30d", "{:.0f}"),
    "log_wa_replies": ("WhatsApp replies (30 days)", "whatsapp_replies_30d", "{:.0f}"),
    "log_video_minutes": ("video minutes (30 days)", "video_minutes_30d", "{:.0f}"),
    "log_invites": ("invitations received", "invites", "{:.0f}"),
}
YES_NO = {  # feature -> (when 1, when 0)
    "is_new_window": ("within 40 days of first course", "past the first 40 days"),
    "has_deep_course": ("has done a deeper course", "only the first course so far"),
}


# ---------------------------------------------------------------------------------------------
# Labels (synthetic only)
# ---------------------------------------------------------------------------------------------
def synthetic_labels() -> pd.Series:
    """participant_id -> stage, from the generator's answer key. Training and evaluation only."""
    cohort = json.loads((config.ROOT / "data" / "synthetic" / "cohort.json").read_text(encoding="utf-8"))
    return pd.Series({p["id"]: config.ARCHETYPE_TO_STAGE[p["archetype"]] for p in cohort}, name="label")


# ---------------------------------------------------------------------------------------------
# Rule-based fallback, and the baseline the learned model has to beat
# ---------------------------------------------------------------------------------------------
def heuristic_stage(f: pd.DataFrame) -> pd.Series:
    """Fixed score cut-offs, read off the synthetic score ranges (Active ~74, Slipping ~46,
    Drifting ~25, Dormant ~12)."""
    e = f["engagement_score"]
    stage = np.select(
        [(f["tenure"] <= config.NEW_WINDOW_DAYS) & f["first_activity_date"].notna(),
         e >= 55, e >= 35, e >= 18],
        ["New", "Active", "Slipping", "Drifting"], default="Dormant")
    return pd.Series(stage, index=f.index)


# ---------------------------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------------------------
def cv_accuracy(X: np.ndarray, y: np.ndarray, features: list[str], l2: float,
                folds: int = 5, seed: int = 7) -> float:
    """Hide 1/5 of people, train on the rest, score the hidden ones; repeat so all are hidden once."""
    rng = np.random.default_rng(seed)
    fold = np.empty(len(y), dtype=int)
    for c in np.unique(y):                       # each fold gets a fair share of every stage
        idx = rng.permutation(np.where(y == c)[0])
        fold[idx] = np.arange(len(idx)) % folds
    correct = 0
    for k in range(folds):
        tr, te = fold != k, fold == k
        m = SoftmaxModel(features, config.STAGES, l2=l2).fit(X[tr], y[tr])
        correct += (m.predict(X[te]) == y[te]).sum()
    return correct / len(y)


def train(ds: Dataset, feats: pd.DataFrame, labels: pd.Series, write: bool = True) -> dict:
    labelled = feats.join(labels, how="inner")
    y = labelled["label"].map({c: i for i, c in enumerate(config.STAGES)}).to_numpy()
    baseline = float((heuristic_stage(labelled) == labelled["label"]).mean())
    out = {}
    for name, groups in VARIANTS.items():
        if not set(groups) <= set(available_groups(ds)):
            continue
        cols = feature_columns(groups)
        X = labelled[cols].to_numpy(float)
        # l2 = how strongly weights are pulled towards zero; pick the value that generalises best.
        scores = {l2: cv_accuracy(X, y, cols, l2) for l2 in (0.003, 0.01, 0.03, 0.1, 0.3)}
        best = max(scores, key=scores.get)
        model = SoftmaxModel(cols, config.STAGES, l2=best).fit(X, y)
        model.meta = {"trained_on": ds.name, "as_of": str(ds.as_of.date()), "n_people": int(len(y)),
                      "groups": groups, "cv_accuracy": round(float(scores[best]), 3),
                      "cv_accuracy_by_l2": {str(k): round(float(v), 3) for k, v in scores.items()},
                      "rule_baseline_accuracy": round(baseline, 3)}
        out[f"stage_{name}"] = model
    if write:
        save(out, config.STAGE_MODEL_FILE)
    return out


# ---------------------------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------------------------
def pick_variant(ds: Dataset, models: dict) -> SoftmaxModel | None:
    have = set(available_groups(ds))
    for name, groups in VARIANTS.items():           # richest first
        if f"stage_{name}" in models and set(groups) <= have:
            return models[f"stage_{name}"]
    return None


def explain(model: SoftmaxModel, x: np.ndarray, cls: int, row: pd.Series) -> str:
    """e.g. 'engagement score 37/100 (low); 60-day trend -11 (falling); events in last year 0 (low)'"""
    parts = []
    for feat, _, z in model.top_drivers(x, cls, n=3):
        if feat in YES_NO:
            parts.append(YES_NO[feat][0] if row[feat] >= 0.5 else YES_NO[feat][1])
            continue
        label, raw, fmt = READABLE.get(feat, (feat, None, "{}"))
        if feat == "trend":
            level = "rising" if row["trend_points"] > 0 else "falling" if row["trend_points"] < 0 else "flat"
        else:
            level = "high" if z > 0 else "low"
        value = fmt.format(row[raw]) if raw in row else ""
        parts.append(f"{label} {value} ({level})".replace("  ", " "))
    return "; ".join(parts)


def assign_stages(ds: Dataset, feats: pd.DataFrame, models: dict | None = None) -> pd.DataFrame:
    models = load(config.STAGE_MODEL_FILE) if models is None else models
    model = pick_variant(ds, models)
    out = pd.DataFrame(index=feats.index)
    if model is None:
        out["journey_stage"] = heuristic_stage(feats)
        out["stage_confidence"] = np.nan
        out["stage_model"] = "rule (no trained model found)"
        out["stage_drivers"] = "engagement score " + feats["engagement_score"].round(0).astype(int).astype(str) + "/100"
    else:
        X = feats[model.features].to_numpy(float)
        P = model.predict_proba(X)
        idx = P.argmax(axis=1)
        out["journey_stage"] = [model.classes[i] for i in idx]
        out["stage_confidence"] = P.max(axis=1).round(2)
        out["stage_model"] = "learned: " + "+".join(model.meta.get("groups", []))
        out["stage_drivers"] = [explain(model, X[i], idx[i], feats.iloc[i]) for i in range(len(X))]
    out["stage"] = out["journey_stage"].map(config.SIMPLE_STAGE)   # Aditya's three stages
    return out
