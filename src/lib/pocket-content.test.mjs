import test from "node:test";
import assert from "node:assert/strict";
import {
  filterDiscoveries,
  getExperience,
} from "./pocket-content.ts";

const discovery = (overrides = {}) => ({
  id: "base",
  emoji: "•",
  title: "看一眼。",
  hint: "留在公共空間。",
  difficulty: "easy",
  kind: "feature",
  ...overrides,
});

test("experience filtering keeps Night-only content out of core and respects daylight", () => {
  const night = discovery({
    id: "night-light",
    suitableFor: ["night"],
    availability: { daylight: "night" },
    tags: ["night", "light"],
  });
  const common = discovery({ id: "common" });

  assert.deepEqual(
    filterDiscoveries([night, common]).map((item) => item.id),
    ["common"],
  );
  assert.deepEqual(
    filterDiscoveries([night, common], {
      experienceId: "night",
      daylight: "day",
    }).map((item) => item.id),
    ["common"],
  );
  assert.deepEqual(
    filterDiscoveries([night, common], {
      experienceId: "night",
      daylight: "night",
    }).map((item) => item.id),
    ["night-light", "common"],
  );
});

test("environment metadata does not hard-filter the curated catalogue", () => {
  const street = discovery({
    id: "street",
    environments: ["street"],
  });
  const green = discovery({
    id: "green",
    environments: ["green"],
  });

  assert.deepEqual(
    filterDiscoveries([street, green], { environment: "street" }).map(
      (item) => item.id,
    ),
    ["street", "green"],
  );
});

test("future weather availability can filter content without journey special cases", () => {
  const rainOnly = discovery({
    id: "rain-trace",
    availability: { weather: "rain" },
  });
  const universal = discovery({ id: "universal-weather" });

  assert.deepEqual(
    filterDiscoveries([rainOnly, universal], { weather: "dry" }).map(
      (item) => item.id,
    ),
    ["universal-weather"],
  );
  assert.deepEqual(
    filterDiscoveries([rainOnly, universal], { weather: "rain" }).map(
      (item) => item.id,
    ),
    ["rain-trace", "universal-weather"],
  );
});

test("Night remains development-only while core is the implicit Experience", () => {
  assert.equal(getExperience().id, "core");
  assert.notEqual(getExperience("core").developmentOnly, true);
  assert.equal(getExperience("night").developmentOnly, true);
});
