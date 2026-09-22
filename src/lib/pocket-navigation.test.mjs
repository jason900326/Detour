import test from "node:test";
import assert from "node:assert/strict";
import { previousPocketScreen } from "./pocket-navigation.ts";

test("live journey and completion never expose a swipe-back destination", () => {
  assert.equal(previousPocketScreen("home", "home"), null);
  assert.equal(previousPocketScreen("home", "detail"), null);
});
test("sharing returns to its actual origin, including the current ticket opened from history", () => {
  assert.equal(previousPocketScreen("share", "home"), "home");
  assert.equal(previousPocketScreen("share", "detail"), "detail");
});
test("secondary pages unwind through their parent screens", () => {
  assert.equal(previousPocketScreen("detail", "home"), "history");
  assert.equal(previousPocketScreen("history", "detail"), "home");
  assert.equal(previousPocketScreen("settings", "home"), "home");
});
