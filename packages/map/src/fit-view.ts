export function averageCoords(coords: [number, number][]): [number, number] | null {
  if (coords.length === 0) return null;
  const lng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
  const lat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
  return [lng, lat];
}

export function applyZoomOffset(zoom: number, offset = -2): number {
  return Math.min(22, Math.max(1, zoom + offset));
}

export function coordsChangedSignificantly(
  a: [number, number],
  b: [number, number],
  minDelta = 1e-6,
): boolean {
  return Math.abs(a[0] - b[0]) > minDelta || Math.abs(a[1] - b[1]) > minDelta;
}

/** ~30m at mid-latitudes; avoids jitter when the map is already near the target. */
export const MAP_CENTER_FOLLOW_THRESHOLD = 0.0003;
