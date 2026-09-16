#!/usr/bin/env python3

from __future__ import annotations

import unittest

from import_osm_scenes import (
    SCORING_VERSION,
    classify,
    evaluate_feature,
    food_commitment_score,
    hard_reject_reason,
    oddity_score,
    scene_traits,
    visual_score,
)


def feature(tags: dict[str, str], osm_id: int = 1) -> dict:
    return {
        "type": "Feature",
        "properties": {
            "@type": "node",
            "@id": osm_id,
            "@timestamp": 1_735_466_949,
            **tags,
        },
        "geometry": {
            "type": "Point",
            "coordinates": [121.5654, 25.033],
        },
    }


class HardRejectTests(unittest.TestCase):
    def test_rejects_sensitive_and_restricted_places_with_auditable_reasons(self) -> None:
        cases = [
            ({"amenity": "place_of_worship"}, "religious"),
            ({"access": "private"}, "restricted_access"),
            ({"amenity": "clinic"}, "healthcare"),
            ({"amenity": "police"}, "police_fire_emergency"),
            ({"landuse": "military"}, "military_prison"),
            ({"office": "government"}, "government"),
            ({"amenity": "school"}, "education"),
            ({"landuse": "cemetery"}, "cemetery_funeral"),
        ]

        for tags, expected in cases:
            with self.subTest(tags=tags):
                self.assertEqual(hard_reject_reason(tags), expected)

    def test_keeps_clearly_public_museum_even_if_government_operated(self) -> None:
        tags = {
            "office": "government",
            "tourism": "museum",
            "name": "消防博物館",
        }
        self.assertIsNone(hard_reject_reason(tags))
        self.assertEqual(classify(tags), ("culture", "文化空間"))


class ClassificationTests(unittest.TestCase):
    def test_adds_scene_v2_detour_types(self) -> None:
        cases = [
            ({"highway": "steps"}, "steps"),
            ({"highway": "footway", "bridge": "yes"}, "footbridge"),
            ({"highway": "pedestrian"}, "pedestrian"),
            (
                {"natural": "tree", "denotation": "natural_monument"},
                "heritage-tree",
            ),
        ]

        for tags, expected_kind in cases:
            with self.subTest(tags=tags):
                classification = classify(tags)
                self.assertIsNotNone(classification)
                self.assertEqual(classification[0], expected_kind)

    def test_vehicle_bridge_does_not_become_footbridge(self) -> None:
        self.assertIsNone(classify({"highway": "primary", "bridge": "yes"}))


class ScoringTests(unittest.TestCase):
    def test_scores_are_bounded_and_independent(self) -> None:
        obscure_steps = {"highway": "steps"}
        famous_art = {
            "tourism": "artwork",
            "artwork_type": "sculpture",
            "wikidata": "Q123",
            "wikimedia_commons": "Category:Example",
            "image": "https://example.test/image.jpg",
        }

        self.assertGreater(oddity_score("steps", obscure_steps), 60)
        self.assertGreater(visual_score("statue", famous_art), 80)
        self.assertLess(oddity_score("statue", famous_art), 60)

    def test_food_commitment_prefers_small_purchases(self) -> None:
        tea = food_commitment_score("food", {"shop": "tea"})
        restaurant = food_commitment_score("food", {"amenity": "restaurant"})
        self.assertIsNotNone(tea)
        self.assertIsNotNone(restaurant)
        self.assertGreater(tea, restaurant)

    def test_traits_are_stable_and_sorted(self) -> None:
        traits = scene_traits(
            "public-bookcase",
            {"amenity": "public_bookcase", "lit": "yes"},
        )
        self.assertEqual(traits, sorted(traits))
        self.assertIn("culture", traits)
        self.assertIn("odd", traits)
        self.assertIn("tiny-public-space", traits)


class NormalizationTests(unittest.TestCase):
    def test_detour_scene_contains_precomputed_v2_fields(self) -> None:
        row, reason = evaluate_feature(
            feature(
                {
                    "tourism": "artwork",
                    "artwork_type": "mural",
                    "name": "巷口壁畫",
                }
            ),
            "test-batch",
        )

        self.assertIsNone(reason)
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row["scene_family"], "detour")
        self.assertEqual(row["scoring_version"], SCORING_VERSION)
        self.assertIsInstance(row["quality_score"], int)
        self.assertIsInstance(row["oddity_score"], int)
        self.assertIsInstance(row["visual_score"], int)
        self.assertIsInstance(row["traits"], list)

    def test_food_and_market_are_only_in_food_family(self) -> None:
        for index, tags in enumerate(
            [
                {"amenity": "cafe", "name": "咖啡店"},
                {"amenity": "marketplace", "name": "市場"},
            ],
            start=10,
        ):
            with self.subTest(tags=tags):
                row, reason = evaluate_feature(
                    feature(tags, osm_id=index),
                    "test-batch",
                )
                self.assertIsNone(reason)
                assert row is not None
                self.assertEqual(row["scene_family"], "food")

    def test_rejected_feature_never_reaches_scoring(self) -> None:
        row, reason = evaluate_feature(
            feature(
                {
                    "tourism": "artwork",
                    "amenity": "hospital",
                    "name": "醫院公共藝術",
                }
            ),
            "test-batch",
        )
        self.assertIsNone(row)
        self.assertEqual(reason, "healthcare")


if __name__ == "__main__":
    unittest.main()

