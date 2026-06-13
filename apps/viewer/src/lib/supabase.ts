import { createSupabaseClient } from "@openmatsuri/realtime";

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, anonKey);
}

export function parseMapCenter(mapCenter: unknown): [number, number] {
  if (mapCenter && typeof mapCenter === "object") {
    const geo = mapCenter as { type?: string; coordinates?: number[] };
    if (geo.type === "Point" && geo.coordinates?.length === 2) {
      return [geo.coordinates[0], geo.coordinates[1]];
    }
  }
  return [135.5023, 34.6937];
}
