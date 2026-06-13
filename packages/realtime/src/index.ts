import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, TrackerLocationRow } from "./database.types";

export type {
  Database,
  TrackerLocationRow,
  TrackerRow,
  EventRow,
  PoiRow,
  RouteRow,
  TrackerWithLocation,
} from "./database.types";

export function createSupabaseClient(
  url: string,
  anonKey: string,
): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey);
}

export type RealtimeMode = "postgres_changes" | "broadcast";

export function getRealtimeMode(): RealtimeMode {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_REALTIME_MODE === "broadcast") {
    return "broadcast";
  }
  return "postgres_changes";
}

export { parseGeoPoint, parseGeoLineString } from "./geo";
