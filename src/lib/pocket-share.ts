import type { Point } from "./pocket-engine";

export function sharePhotos(photos: string[], cover?: string) {
  const unique = [...new Set(photos)];
  const first = cover && unique.includes(cover) ? cover : unique[0];
  return first ? [first, ...unique.filter(uri => uri !== first).slice(0, 4)] : [];
}

/** Uniform scale preserves the actual route shape; no independently stretched axes. */
export function shareRoute(points: Point[], width: number, height: number) {
  const valid = points.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  if (valid.length < 2) return null;
  const cos = Math.cos(valid[0].latitude * Math.PI / 180);
  const xs = valid.map(p => p.longitude * cos);
  const ys = valid.map(p => -p.latitude);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX, spanY = Math.max(...ys) - minY;
  if (Math.max(spanX, spanY) < 0.000001) return null;
  const scale = Math.min((width - 20) / (spanX || 0.000001), (height - 20) / (spanY || 0.000001));
  const coords = valid.map((_, i) => ({
    x: (width - spanX * scale) / 2 + (xs[i] - minX) * scale,
    y: (height - spanY * scale) / 2 + (ys[i] - minY) * scale,
  }));
  return { path: coords.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" "), start: coords[0], end: coords.at(-1)! };
}
