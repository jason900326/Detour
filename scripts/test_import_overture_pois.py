#!/usr/bin/env python3

from __future__ import annotations

import unittest

from import_overture_pois import evaluate_feature


def feature(
    *,
    feature_id: str,
    name: str,
    brand: str | None = None,
    category: str = "bank",
    address: str = "臺北市內湖區",
    longitude: float = 121.593,
    latitude: float = 25.069,
    confidence: float = 0.9,
) -> dict:
    properties = {
        "names": {"primary": name},
        "basic_category": category,
        "addresses": [
            {
                "freeform": address,
                "locality": "內湖區",
                "region": "臺北市",
                "country": "TW",
            }
        ],
        "confidence": confidence,
        "operating_status": "open",
        "sources": [{"update_time": "2026-08-01T00:00:00Z"}],
    }
    if brand:
        properties["brand"] = {"names": {"primary": brand}}
    return {
        "type": "Feature",
        "id": feature_id,
        "properties": properties,
        "geometry": {"type": "Point", "coordinates": [longitude, latitude]},
    }


class OverturePoiNormalizationTests(unittest.TestCase):
    def test_keeps_exact_bank_branch_name_and_address(self) -> None:
        row, reason = evaluate_feature(
            feature(
                feature_id="land-bank-neihu",
                name="臺灣土地銀行內湖分行",
                brand="臺灣土地銀行",
                address="臺北市內湖區民權東路六段",
            ),
            "test-batch",
        )

        self.assertIsNone(reason)
        assert row is not None
        self.assertEqual(row["name"], "臺灣土地銀行內湖分行")
        self.assertEqual(row["address"], "臺北市內湖區民權東路六段")
        self.assertIn("土地銀行", row["search_text"])
        self.assertIn("台灣土地銀行", row["search_text"])

    def test_adds_cross_language_brand_aliases(self) -> None:
        row, reason = evaluate_feature(
            feature(
                feature_id="starbucks-neihu",
                name="Starbucks Neihu Branch",
                brand="Starbucks",
                category="cafe",
            ),
            "test-batch",
        )

        self.assertIsNone(reason)
        assert row is not None
        self.assertIn("星巴克", row["aliases"])
        self.assertIn("星巴克", row["search_text"])

    def test_generic_category_search_terms_are_indexed(self) -> None:
        row, reason = evaluate_feature(
            feature(
                feature_id="convenience-1",
                name="某某門市",
                category="convenience_store",
            ),
            "test-batch",
        )

        self.assertIsNone(reason)
        assert row is not None
        self.assertIn("便利商店", row["search_text"])
        self.assertIn("超商", row["search_text"])

    def test_rejects_closed_and_low_confidence_records(self) -> None:
        low, low_reason = evaluate_feature(
            feature(feature_id="low", name="可疑地點", confidence=0.2),
            "test-batch",
        )
        self.assertIsNone(low)
        self.assertEqual(low_reason, "low_confidence")

        closed_feature = feature(feature_id="closed", name="已歇業分行")
        closed_feature["properties"]["operating_status"] = "permanently_closed"
        closed, closed_reason = evaluate_feature(closed_feature, "test-batch")
        self.assertIsNone(closed)
        self.assertEqual(closed_reason, "permanently_closed")


if __name__ == "__main__":
    unittest.main()
