export function parseCenter(mapCenter: unknown): [number, number] {
  if (mapCenter && typeof mapCenter === "object") {
    const g = mapCenter as { coordinates?: number[] };
    if (g.coordinates?.length === 2) return [g.coordinates[0], g.coordinates[1]];
  }
  return [135.5023, 34.6937];
}
