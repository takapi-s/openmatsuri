"use client";

import {
  getOrCreateViewerSessionToken,
  postViewerLocation,
  VIEWER_LOCATION_INTERVAL_MS,
} from "@openmatsuri/viewer-ingest";
import { useCallback, useEffect, useRef } from "react";

type Props = {
  eventId: string;
  enabled: boolean;
};

export function useViewerLocationReporter({ eventId, enabled }: Props) {
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<GeolocationPosition | null>(null);
  const sendingRef = useRef(false);

  const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const sendCurrent = useCallback(async () => {
    if (!enabled || !endpoint || !anonKey) return;

    const position = lastPositionRef.current;
    if (!position || sendingRef.current) return;

    sendingRef.current = true;
    const { latitude, longitude, accuracy } = position.coords;
    await postViewerLocation({
      endpoint,
      anonKey,
      sessionToken: getOrCreateViewerSessionToken(eventId),
      eventId,
      lat: latitude,
      lng: longitude,
      accuracy,
    });
    sendingRef.current = false;
  }, [enabled, endpoint, anonKey, eventId]);

  useEffect(() => {
    if (!enabled) return;

    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        lastPositionRef.current = position;
      },
      undefined,
      { enableHighAccuracy: true, maximumAge: VIEWER_LOCATION_INTERVAL_MS, timeout: 15000 },
    );

    void sendCurrent();
    const intervalId = window.setInterval(() => {
      void sendCurrent();
    }, VIEWER_LOCATION_INTERVAL_MS);

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      window.clearInterval(intervalId);
      lastPositionRef.current = null;
    };
  }, [enabled, sendCurrent]);
}
