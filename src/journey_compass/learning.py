"""Learning loop: recorded outcomes update how often each stage takes up each kind of offer.

Each (stage, offer kind) rate starts at config.ACCEPTANCE_PRIOR, counted as PRIOR_STRENGTH
imagined outcomes, and moves with real ones (a beta-binomial posterior mean):

    rate = (prior * PRIOR_STRENGTH + successes) / (PRIOR_STRENGTH + outcomes)

Attended or accepted counts as a success; declined or no response as a failure. A handful of
outcomes nudges the ranking; enough of them outweigh the prior.
"""
from dataclasses import dataclass

from . import config


@dataclass
class Rate:
    stage: str
    offer_type: str
    prior: float
    rate: float
    successes: int
    trials: int


def learned_rates(outcomes: list[dict], prior: dict = None, strength: float = None) -> list[Rate]:
    """outcomes: dicts with stage (New..Dormant), offer_type and result."""
    prior = prior or config.ACCEPTANCE_PRIOR
    strength = config.PRIOR_STRENGTH if strength is None else strength
    counts = {}
    for o in outcomes:
        if o.get("stage") not in prior or o.get("offer_type") not in prior[o["stage"]]:
            continue
        s, n = counts.get((o["stage"], o["offer_type"]), (0, 0))
        counts[(o["stage"], o["offer_type"])] = (s + (o["result"] in config.SUCCESS_RESULTS), n + 1)
    rates = []
    for stage, kinds in prior.items():
        for kind, p in kinds.items():
            s, n = counts.get((stage, kind), (0, 0))
            rates.append(Rate(stage, kind, p, (p * strength + s) / (strength + n) if n else p, s, n))
    return rates


def as_table(rates: list[Rate]) -> dict:
    """The {stage: {offer_type: rate}} shape scoring reads (config.ACCEPTANCE_RATES)."""
    table = {}
    for r in rates:
        table.setdefault(r.stage, {})[r.offer_type] = r.rate
    return table
