"""Train the stage model on the synthetic cohort and save it to models/stage_model.json.

Run:  python -m journey_compass.train        (with PYTHONPATH=src)

It always trains on data/synthetic, whatever JC_DATASET says: that is the only dataset with an
answer key. The generator's labels are read from cohort.json here and nowhere else.
"""
from . import config
from .data_loader import load_dataset
from .features import compute_features
from .stage_model import synthetic_labels, train


def main() -> None:
    ds = load_dataset(config.ROOT / "data" / "synthetic")
    models = train(ds, compute_features(ds), synthetic_labels())
    print(f"Trained on {ds.name} ({len(ds.participants)} people, as of {ds.as_of.date()})")
    for name, m in models.items():
        meta = m.meta
        print(f"  {name:12s} {len(m.features):2d} features  "
              f"cross-validated accuracy {meta['cv_accuracy']:.0%}  "
              f"(rule baseline {meta['rule_baseline_accuracy']:.0%})")
    print(f"Saved to {config.STAGE_MODEL_FILE.relative_to(config.ROOT)}")


if __name__ == "__main__":
    main()
