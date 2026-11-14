"""A small, inspectable learned model in plain numpy, saved as JSON.

SoftmaxModel is multinomial logistic regression: for each stage it keeps one weight per feature,
adds up weight x feature, and turns the per-stage totals into probabilities.

Why not a bigger model: 180 labelled people are far too few for anything complex. The weights
stay readable ("a low engagement score pushes towards Dormant"), it trains in about a second, and
it needs no new dependency.
"""
import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np


def _adam(grad_fn, w0: np.ndarray, steps: int, lr: float = 0.05) -> np.ndarray:
    w, m, v = w0.copy(), np.zeros_like(w0), np.zeros_like(w0)
    b1, b2, eps = 0.9, 0.999, 1e-8
    for t in range(1, steps + 1):
        g = grad_fn(w)
        m = b1 * m + (1 - b1) * g
        v = b2 * v + (1 - b2) * g * g
        w -= lr * (m / (1 - b1 ** t)) / (np.sqrt(v / (1 - b2 ** t)) + eps)
    return w


def _softmax(z: np.ndarray) -> np.ndarray:
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


@dataclass
class Scaler:
    mean: np.ndarray
    std: np.ndarray

    @classmethod
    def fit(cls, X: np.ndarray) -> "Scaler":
        std = X.std(axis=0)
        return cls(X.mean(axis=0), np.where(std < 1e-9, 1.0, std))

    def __call__(self, X: np.ndarray) -> np.ndarray:
        return np.column_stack([(X - self.mean) / self.std, np.ones(len(X))])  # + bias column


@dataclass
class SoftmaxModel:
    features: list[str]
    classes: list[str]
    l2: float = 0.1
    scaler: Scaler | None = None
    W: np.ndarray | None = None          # (n_features + 1) x n_classes
    meta: dict = field(default_factory=dict)

    def fit(self, X: np.ndarray, y: np.ndarray, steps: int = 1500, balanced: bool = True) -> "SoftmaxModel":
        self.scaler = Scaler.fit(X)
        Xs = self.scaler(X)
        Y = np.eye(len(self.classes))[y]
        counts = Y.sum(axis=0)
        cw = (len(y) / (len(self.classes) * np.maximum(counts, 1))) if balanced else np.ones(len(self.classes))
        sw = (Y * cw).sum(axis=1)[:, None]
        reg = np.ones((Xs.shape[1], 1)); reg[-1] = 0  # don't shrink the bias

        def grad(w):
            W = w.reshape(Xs.shape[1], -1)
            P = _softmax(Xs @ W)
            return (Xs.T @ ((P - Y) * sw) / len(Xs) + self.l2 * reg * W).ravel()

        self.W = _adam(grad, np.zeros(Xs.shape[1] * len(self.classes)), steps).reshape(Xs.shape[1], -1)
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return _softmax(self.scaler(X) @ self.W)

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.predict_proba(X).argmax(axis=1)

    def top_drivers(self, x: np.ndarray, cls: int, n: int = 3) -> list[tuple[str, float, float]]:
        """Features that pushed this one row towards `cls` most, relative to the other classes.

        Returns (feature, contribution, z) where z > 0 means the value is above the training
        average and z < 0 below it, so callers can say "high" or "low".
        """
        xs = self.scaler(x[None, :])[0][:-1]
        W = self.W[:-1]
        contrib = xs * (W[:, cls] - W.mean(axis=1))
        idx = np.argsort(-contrib)[:n]
        return [(self.features[i], float(contrib[i]), float(xs[i])) for i in idx if contrib[i] > 0]

    def to_dict(self) -> dict:
        return {"kind": "softmax", "features": self.features, "classes": self.classes, "l2": self.l2,
                "mean": self.scaler.mean.tolist(), "std": self.scaler.std.tolist(),
                "W": self.W.tolist(), "meta": self.meta}

    @classmethod
    def from_dict(cls, d: dict) -> "SoftmaxModel":
        return cls(d["features"], d["classes"], d["l2"], Scaler(np.array(d["mean"]), np.array(d["std"])),
                   np.array(d["W"]), d.get("meta", {}))


def save(models: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({k: m.to_dict() for k, m in models.items()}, indent=1), encoding="utf-8")


def load(path: Path) -> dict:
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {k: SoftmaxModel.from_dict(d) for k, d in raw.items()}
