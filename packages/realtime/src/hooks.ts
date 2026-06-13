"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { Database, PoiRow, TrackerLocationRow } from "./database.types";
import { getRealtimeMode } from "./index";

const LOCATION_POLL_MS = 8_000;

function touchTrackerReceived(
  setLastReceivedAt: Dispatch<SetStateAction<Record<string, number>>>,
  trackerIds: string[],
) {
  if (trackerIds.length === 0) return;
  const now = Date.now();
  setLastReceivedAt((prev) => {
    const next = { ...prev };
    for (const trackerId of trackerIds) {
      next[trackerId] = now;
    }
    return next;
  });
}

export function useTrackerLocations(
  supabase: SupabaseClient<Database>,
  eventId: string | null,
) {
  const [locations, setLocations] = useState<TrackerLocationRow[]>([]);
  const [lastReceivedAt, setLastReceivedAt] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    if (!eventId) return;

    const { data, error: fetchError } = await supabase
      .from("tracker_locations")
      .select("*")
      .eq("event_id", eventId);

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    const incoming = data ?? [];
    setLocations((prev) => {
      const receivedTrackerIds = incoming
        .filter((row) => {
          const previous = prev.find((item) => item.tracker_id === row.tracker_id);
          return !previous || previous.updated_at !== row.updated_at;
        })
        .map((row) => row.tracker_id);
      touchTrackerReceived(setLastReceivedAt, receivedTrackerIds);
      return incoming;
    });
    setError(null);
  }, [supabase, eventId]);

  useEffect(() => {
    if (!eventId) return;

    let cancelled = false;

    async function loadInitial() {
      const { data, error: fetchError } = await supabase
        .from("tracker_locations")
        .select("*")
        .eq("event_id", eventId!);

      if (!cancelled) {
        if (fetchError) setError(fetchError.message);
        else {
          const rows = data ?? [];
          setLocations(rows);
          touchTrackerReceived(
            setLastReceivedAt,
            rows.map((row) => row.tracker_id),
          );
          setError(null);
        }
        setLoading(false);
      }
    }

    loadInitial();

    const poll = window.setInterval(() => {
      void fetchLocations();
    }, LOCATION_POLL_MS);

    const mode = getRealtimeMode();

    if (mode === "broadcast") {
      const channel = supabase
        .channel(`event:${eventId}`)
        .on("broadcast", { event: "location_update" }, ({ payload }) => {
          const update = payload as TrackerLocationRow;
          setLocations((prev) => {
            const idx = prev.findIndex((l) => l.tracker_id === update.tracker_id);
            const changed =
              idx < 0 || prev[idx]?.updated_at !== update.updated_at;
            if (changed) {
              touchTrackerReceived(setLastReceivedAt, [update.tracker_id]);
            }
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = update;
              return next;
            }
            return [...prev, update];
          });
        })
        .subscribe();
      return () => {
        cancelled = true;
        window.clearInterval(poll);
        supabase.removeChannel(channel);
      };
    }

    const channel = supabase
      .channel(`tracker_locations:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tracker_locations",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as TrackerLocationRow;
          if (!row?.tracker_id) return;
          setLocations((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((l) => l.tracker_id !== row.tracker_id);
            }
            const idx = prev.findIndex((l) => l.tracker_id === row.tracker_id);
            const changed = idx < 0 || prev[idx]?.updated_at !== row.updated_at;
            if (changed) {
              touchTrackerReceived(setLastReceivedAt, [row.tracker_id]);
            }
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = row;
              return next;
            }
            return [...prev, row];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [supabase, eventId, fetchLocations]);

  return { locations, loading, error, lastReceivedAt, refetch: fetchLocations };
}

export function useEventPois(
  supabase: SupabaseClient<Database>,
  eventId: string | null,
  initialPois: PoiRow[] = [],
) {
  const [pois, setPois] = useState<PoiRow[]>(initialPois);

  useEffect(() => {
    setPois(initialPois);
  }, [initialPois]);

  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`pois:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pois",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as PoiRow;
            setPois((prev) => prev.filter((poi) => poi.id !== deleted.id));
            return;
          }

          const row = payload.new as PoiRow;
          setPois((prev) => {
            const index = prev.findIndex((poi) => poi.id === row.id);
            if (index >= 0) {
              const next = [...prev];
              next[index] = row;
              return next;
            }
            return [...prev, row];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, eventId]);

  return { pois, setPois };
}

/** Last location update within this window is treated as actively receiving. */
export const TRACKER_STALE_MS = 120_000;

/** @deprecated Use TRACKER_STALE_MS */
export const TRACKER_ONLINE_WINDOW_MS = TRACKER_STALE_MS;

export function getTrackerLastSeenAt(
  tracker: { last_seen_at: string | null },
  location?: { updated_at: string } | null,
): string | null {
  const timestamps = [location?.updated_at, tracker.last_seen_at].filter(Boolean) as string[];
  if (timestamps.length === 0) return null;
  return timestamps.reduce((latest, value) => (value > latest ? value : latest));
}

export function isTrackerOnline(
  tracker: { last_seen_at: string | null },
  location?: { updated_at: string } | null,
  clientReceivedAt?: number,
  now = Date.now(),
): boolean {
  if (clientReceivedAt != null && now - clientReceivedAt < TRACKER_STALE_MS) {
    return true;
  }
  const lastSeenAt = getTrackerLastSeenAt(tracker, location);
  if (!lastSeenAt) return false;
  return now - new Date(lastSeenAt).getTime() < TRACKER_STALE_MS;
}

export function isTrackerStale(
  tracker: { last_seen_at: string | null },
  location?: { updated_at: string } | null,
  clientReceivedAt?: number,
  now = Date.now(),
): boolean {
  if (isTrackerOnline(tracker, location, clientReceivedAt, now)) return false;
  return !!getTrackerLastSeenAt(tracker, location);
}
