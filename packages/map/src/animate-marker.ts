import type { Marker } from "maplibre-gl";

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function coordsEqual(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
}

export function animateMarkerLngLat(
  marker: Marker,
  target: [number, number],
  durationMs: number,
  getFrameId: () => number | undefined,
  setFrameId: (id: number | undefined) => void,
): void {
  const current = marker.getLngLat();
  const from: [number, number] = [current.lng, current.lat];
  if (coordsEqual(from, target)) return;

  const existing = getFrameId();
  if (existing != null) cancelAnimationFrame(existing);

  const startTime = performance.now();

  const tick = (now: number) => {
    const t = Math.min(1, (now - startTime) / durationMs);
    const eased = easeInOutCubic(t);
    const lng = from[0] + (target[0] - from[0]) * eased;
    const lat = from[1] + (target[1] - from[1]) * eased;
    marker.setLngLat([lng, lat]);

    if (t < 1) {
      setFrameId(requestAnimationFrame(tick));
    } else {
      setFrameId(undefined);
    }
  };

  setFrameId(requestAnimationFrame(tick));
}

export function cancelMarkerAnimation(
  getFrameId: () => number | undefined,
  setFrameId: (id: number | undefined) => void,
): void {
  const existing = getFrameId();
  if (existing != null) cancelAnimationFrame(existing);
  setFrameId(undefined);
}
