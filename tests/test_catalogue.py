"""Step 2a: the offer catalogue (standing offers + real upcoming programmes)."""
import subprocess
import sys

import pandas as pd
import pytest

from journey_compass import config
from journey_compass.catalogue import OFFER_TYPES, load_catalogue

MOCK = config.ROOT / "Mock data"


def test_standing_offers_are_valid():
    standing = pd.read_csv(config.CATALOGUE_DIR / "standing_offers.csv", dtype=str).fillna("")
    assert standing["offer_id"].is_unique
    assert set(standing["offer_type"]) <= set(OFFER_TYPES)
    assert (standing["start_date"] == "").all()          # standing = always available
    assert {"seva", "reconnect", "event"} <= set(standing["offer_type"])


def test_catalogue_loads_without_the_programmes_file(tmp_path, monkeypatch):
    (tmp_path / "standing_offers.csv").write_text(
        (config.CATALOGUE_DIR / "standing_offers.csv").read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setattr(config, "CATALOGUE_DIR", tmp_path)
    cat = load_catalogue()
    assert len(cat) > 0 and cat["start_date"].isna().all()


@pytest.mark.skipif(not MOCK.exists(), reason="organisers' mock data is local only")
def test_real_programmes_are_upcoming_and_well_formed():
    subprocess.run([sys.executable, str(config.ROOT / "scripts" / "build_catalogue.py")], check=True,
                   capture_output=True)
    cat = load_catalogue()
    real = cat[cat["source"].isin(["harmony", "eventbrite", "retreat_guru"])]
    assert len(real) > 0
    assert (real["start_date"] > pd.Timestamp("2026-11-14")).all()
    assert set(real["offer_type"]) <= set(OFFER_TYPES)
    assert real["commitment"].between(1, 5).all()
    assert cat["offer_id"].is_unique
    online = real[real["program_key"] == "online_workshop"]
    assert (online["city"] == "Online").all()
