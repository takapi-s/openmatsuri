"use client";

import { MatsuriMap } from "@openmatsuri/map";
import {
  useEventPois,
  useTrackerLocations,
  type EventRow,
  type PoiRow,
  type RouteRow,
  type TrackerRow,
} from "@openmatsuri/realtime/client";
import { AppShell } from "@openmatsuri/ui";
import { useMemo, useState } from "react";
import { getSupabase, parseMapCenter } from "@/lib/supabase";

type Props = {
  event: EventRow;
  trackers: TrackerRow[];
  pois: PoiRow[];
  routes: RouteRow[];
  embed?: boolean;
};

const GMAPS_BLUE = "#1a73e8";
const GMAPS_ELEVATION = "shadow-[0_1px_4px_rgba(0,0,0,0.28)]";

function IconMyLocation({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
    </svg>
  );
}

function IconCenterTracker({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={`size-5 shrink-0 ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M7 10l5 5 5-5H7z" />
    </svg>
  );
}

export function EventMapView({ event, trackers, pois: initialPois, routes, embed }: Props) {
  const supabase = useMemo(() => getSupabase(), []);
  const { locations, loading } = useTrackerLocations(supabase, event.id);
  const { pois } = useEventPois(supabase, event.id, initialPois);
  const [selectedTracker, setSelectedTracker] = useState<TrackerRow | null>(null);
  const [focusUserSignal, setFocusUserSignal] = useState(0);
  const [focusTrackerSignal, setFocusTrackerSignal] = useState(0);

  const center = parseMapCenter(event.map_center);
  const liveCount = locations.length;
  const focusZoom = Math.max(event.map_zoom, 15);
  const locationByTracker = useMemo(
    () => new Map(locations.map((loc) => [loc.tracker_id, loc])),
    [locations],
  );

  const selectedTrackerHasLocation =
    selectedTracker != null && locationByTracker.has(selectedTracker.id);

  const mapOverlays = (
    <>
      {!embed && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4">
          <div
            className={`pointer-events-auto max-w-sm truncate rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-800 ${GMAPS_ELEVATION}`}
          >
            {event.name}
          </div>
        </div>
      )}

      {loading && (
        <div
          className={`absolute right-4 top-3 z-10 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ${GMAPS_ELEVATION}`}
        >
          読み込み中...
        </div>
      )}

      <button
        type="button"
        onClick={() => setFocusUserSignal((n) => n + 1)}
        className={`pointer-events-auto absolute bottom-[7rem] right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white active:bg-slate-100 ${GMAPS_ELEVATION}`}
        style={{ color: GMAPS_BLUE }}
        title="現在地に戻る"
        aria-label="現在地に戻る"
      >
        <IconMyLocation />
      </button>

      <div className="pointer-events-auto absolute inset-x-4 bottom-4 z-10 mx-auto max-w-md">
        <div className={`flex items-center rounded-full bg-white py-1.5 pl-4 pr-1.5 ${GMAPS_ELEVATION}`}>
          <label className="sr-only" htmlFor="tracker-picker">
            トラッカーを選択
          </label>
          <div className="relative min-w-0 flex-1">
            <select
              id="tracker-picker"
              value={selectedTracker?.id ?? ""}
              onChange={(e) => {
                const tracker = trackers.find((t) => t.id === e.target.value);
                setSelectedTracker(tracker ?? null);
              }}
              className="w-full cursor-pointer appearance-none border-0 bg-transparent py-2 pr-7 text-sm font-medium text-slate-800 focus:outline-none [&::-ms-expand]:hidden"
            >
              <option value="">トラッカーを選択</option>
              {trackers.map((tracker) => {
                const live = locationByTracker.has(tracker.id);
                return (
                  <option key={tracker.id} value={tracker.id}>
                    {tracker.name}
                    {live ? " · 受信中" : ""}
                  </option>
                );
              })}
            </select>
            <IconChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-500" />
          </div>

          <div className="mx-1 h-6 w-px bg-slate-200" />

          <button
            type="button"
            onClick={() => setFocusTrackerSignal((n) => n + 1)}
            disabled={!selectedTrackerHasLocation}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-35 active:bg-slate-100"
            style={{ color: GMAPS_BLUE }}
            title="選択トラッカーを中心に"
            aria-label="選択トラッカーを中心に"
          >
            <IconCenterTracker />
          </button>
        </div>

        {liveCount > 0 && (
          <p className="mt-2 text-center text-xs font-medium text-white drop-shadow-sm">
            {liveCount} 台が受信中
          </p>
        )}
      </div>
    </>
  );

  const mapView = (
    <div className="relative h-full min-h-0 w-full bg-slate-200">
      <MatsuriMap
        center={center}
        zoom={event.map_zoom}
        trackers={trackers}
        locations={locations}
        pois={pois}
        routes={routes.filter((r) => r.is_visible)}
        onTrackerClick={setSelectedTracker}
        initialViewReady={!loading}
        showUserLocation
        followTrackersCenter={false}
        focusUserSignal={focusUserSignal}
        focusTracker={
          selectedTracker
            ? { trackerId: selectedTracker.id, signal: focusTrackerSignal }
            : null
        }
        focusZoom={focusZoom}
        className="absolute inset-0 h-full w-full"
      />
      {mapOverlays}
    </div>
  );

  if (embed) {
    return <div className="relative h-screen w-full">{mapView}</div>;
  }

  return (
    <AppShell appLabel="Viewer" fill compact footer={false}>
      <div className="relative h-full min-h-0">{mapView}</div>
    </AppShell>
  );
}
