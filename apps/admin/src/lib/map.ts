import { parseGeoPoint } from "@openmatsuri/realtime";

export function parseCenter(mapCenter: unknown): [number, number] {
  return parseGeoPoint(mapCenter) ?? [135.5023, 34.6937];
}
