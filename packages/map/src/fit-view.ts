export function applyZoomOffset(zoom: number, offset = 0): number {
  return Math.min(22, Math.max(1, zoom + offset));
}

export function coordsChangedSignificantly(
  a: [number, number],
  b: [number, number],
  minDelta = 1e-6,
): boolean {
  return Math.abs(a[0] - b[0]) > minDelta || Math.abs(a[1] - b[1]) > minDelta;
}
