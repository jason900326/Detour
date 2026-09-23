import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseDiscovery,
  chooseDiscoveryDifficulty,
  discoveryWeight,
  filterDiscoveries,
  getExperience,
  selectDiscovery,
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

test("experience filtering keeps Night-only content out of core and unavailable daylight", () => {
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

test("environment is a weak weight, not a hard filter", () => {
  const street = discovery({
    id: "street",
    environments: ["street"],
  });
  const green = discovery({
    id: "green",
    environments: ["green"],
  });

  assert.ok(
    discoveryWeight(street, { environment: "street" }) >
      discoveryWeight(green, { environment: "street" }),
  );
  assert.ok(
    filterDiscoveries([street, green], { environment: "street" }).some(
      (item) => item.id === "green",
    ),
  );
});

test("difficulty starts easy, recovers after slow finds and never makes hard consecutive", () => {
  assert.equal(chooseDiscoveryDifficulty([], () => 0), "easy");

  const mediumSlow = discovery({
    id: "slow",
    difficulty: "medium",
    seconds: 130,
  });
  assert.equal(
    chooseDiscoveryDifficulty([mediumSlow], () => 0),
    "easy",
  );

  const hardFast = discovery({
    id: "hard",
    difficulty: "hard",
    seconds: 20,
  });
  assert.notEqual(
    chooseDiscoveryDifficulty([hardFast, hardFast], () => 0),
    "hard",
  );
});

test("a themed Experience falls back to universal content when its themed pool is exhausted", () => {
  const themed = discovery({
    id: "night-only",
    tags: ["night", "light"],
    suitableFor: ["night"],
    availability: { daylight: "night" },
  });
  const universal = discovery({ id: "universal" });

  const selected = selectDiscovery(
    [themed, universal],
    [],
    ["night-only"],
    {
      experienceId: "night",
      daylight: "night",
      environment: "street",
    },
    () => 0,
  );

  assert.equal(selected.id, "universal");
});

test("core experience works when no Experience is specified", () => {
  for (let index = 0; index < 20; index++) {
    const selected = chooseDiscovery([], [], {}, () => index / 20);
    assert.equal(selected.suitableFor?.includes("night") ?? false, false);
  }
});

test("selection is deterministic when randomness is injected", () => {
  const catalogue = [
    discovery({ id: "first" }),
    discovery({ id: "second" }),
  ];

  assert.equal(
    selectDiscovery(catalogue, [], [], {}, () => 0).id,
    "first",
  );
  assert.equal(
    selectDiscovery(catalogue, [], [], {}, () => 0.999).id,
    "second",
  );
});


test("future weather availability can filter content without special-case journey code", () => {
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


test("Night is development-only while core remains the implicit production Experience", () => {
  assert.equal(getExperience().id, "core");
  assert.notEqual(getExperience("core").developmentOnly, true);
  assert.equal(getExperience("night").developmentOnly, true);
});
