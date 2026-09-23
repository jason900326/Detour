import test from "node:test";
import assert from "node:assert/strict";
import { sharePhotos, shareRoute } from "./pocket-share.ts";

test("cover selection retains up to four distinct memories without duplication", () => {
  assert.deepEqual(sharePhotos([], "missing"), []);
  assert.deepEqual(sharePhotos(["a"]), ["a"]);
  assert.deepEqual(sharePhotos(["a", "b", "c"], "c"), ["c", "a", "b"]);
  assert.deepEqual(sharePhotos(["a", "a", "b", "c", "d", "e", "f"], "f"), ["f", "a", "b", "c", "d"]);
  assert.deepEqual(sharePhotos(["a", "b"], "missing"), ["a", "b"]);
});

test("route keeps geographic proportions inside both portrait and square frames", () => {
  const points = [{ latitude: 0, longitude: 0 }, { latitude: 0.001, longitude: 0.002 }];
  for (const [w, h] of [[82, 204], [280, 310]]) {
    const r = shareRoute(points, w, h);
    assert.ok(r);
    assert.ok(Math.abs((r.end.x - r.start.x) / (r.start.y - r.end.y) - 2) < 1e-8);
    for (const p of [r.start, r.end]) {
      assert.ok(p.x >= 9.99 && p.x <= w - 9.99);
      assert.ok(p.y >= 9.99 && p.y <= h - 9.99);
    }
  }
});

test("missing, stationary and invalid traces never fabricate a route", () => {
  assert.equal(shareRoute([], 82, 204), null);
  assert.equal(shareRoute([{ latitude: 25, longitude: 121 }], 82, 204), null);
  assert.equal(shareRoute(Array(4).fill({ latitude: 25, longitude: 121 }), 82, 204), null);
  assert.equal(shareRoute([{ latitude: NaN, longitude: 121 }, { latitude: 25, longitude: 121 }], 82, 204), null);
});
