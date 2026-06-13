import { createSupabaseClient, parseGeoPoint } from "@openmatsuri/realtime";

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseClient(url, anonKey);
}

export function parseMapCenter(mapCenter: unknown): [number, number] {
  return parseGeoPoint(mapCenter) ?? [135.5023, 34.6937];
}
