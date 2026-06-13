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
  const intervalIdRef = useRef<number | null>(null);

  const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const sendCurrent = useCallback(async () => {
    if (!enabled || !endpoint || !anonKey) return;

    const position = lastPositionRef.current;
    if (!position || sendingRef.current) return;

    sendingRef.current = true;
    const { latitude, longitude, accuracy } = position.coords;
    const result = await postViewerLocation({
      endpoint,
      anonKey,
      sessionToken: getOrCreateViewerSessionToken(eventId),
      eventId,
      lat: latitude,
      lng: longitude,
      accuracy,
    });
    sendingRef.current = false;

    if (!result.ok) {
      console.warn("[viewer-location] send failed:", result.error);
    }
  }, [enabled, endpoint, anonKey, eventId]);

  const handlePosition = useCallback(
    (position: GeolocationPosition) => {
      const isFirstFix = lastPositionRef.current == null;
      lastPositionRef.current = position;
      if (isFirstFix) {
        void sendCurrent();
      }
    },
    [sendCurrent],
  );

  useEffect(() => {
    if (!enabled) return;

    if (!navigator.geolocation) {
      console.warn("[viewer-location] geolocation not supported");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      (error) => {
        console.warn("[viewer-location] geolocation error:", error.message);
      },
      { enableHighAccuracy: true, maximumAge: VIEWER_LOCATION_INTERVAL_MS, timeout: 15000 },
    );

    intervalIdRef.current = window.setInterval(() => {
      void sendCurrent();
    }, VIEWER_LOCATION_INTERVAL_MS);

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalIdRef.current != null) {
        window.clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      lastPositionRef.current = null;
    };
  }, [enabled, handlePosition, sendCurrent]);
}
