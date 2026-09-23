import test from "node:test";
import assert from "node:assert/strict";
import {
  makeStoredEnvelope,
  parseStoredEnvelope,
  selectStoredData,
} from "./storage-envelope.ts";

test("legacy plain JSON remains readable", () => {
  assert.deepEqual(selectStoredData(JSON.stringify({ hello: "world" }), null), {
    hello: "world",
  });
});

test("current envelopes return their data", () => {
  const raw = JSON.stringify(makeStoredEnvelope({ value: 2 }, 10));
  assert.deepEqual(selectStoredData(raw, null), { value: 2 });
});

test("a newer pending copy wins after an interrupted write", () => {
  const primary = JSON.stringify(makeStoredEnvelope({ value: 1 }, 10));
  const pending = JSON.stringify(makeStoredEnvelope({ value: 2 }, 20));
  assert.deepEqual(selectStoredData(primary, pending), { value: 2 });
});

test("invalid JSON falls back to the other valid copy", () => {
  const pending = JSON.stringify(makeStoredEnvelope(["safe"], 20));
  assert.deepEqual(selectStoredData("{broken", pending), ["safe"]);
  assert.equal(parseStoredEnvelope("{broken"), null);
});

test("an older pending copy never replaces a newer primary", () => {
  const primary = JSON.stringify(makeStoredEnvelope({ value: 3 }, 30));
  const pending = JSON.stringify(makeStoredEnvelope({ value: 2 }, 20));
  assert.deepEqual(selectStoredData(primary, pending), { value: 3 });
});

test("validator rejection returns null rather than unsafe data", () => {
  const isNumberArray = (value) =>
    Array.isArray(value) && value.every((item) => typeof item === "number");
  assert.equal(
    selectStoredData(JSON.stringify(["not", "numbers"]), null, isNumberArray),
    null,
  );
  assert.deepEqual(
    selectStoredData(JSON.stringify([1, 2]), null, isNumberArray),
    [1, 2],
  );
});
