"use client";

import { DEFAULT_MAP_STYLE, POI_KIND_COLORS } from "@openmatsuri/config";
import type { PoiRow, RouteRow, TrackerLocationRow, TrackerRow } from "@openmatsuri/realtime";
import { parseGeoLineString, parseGeoPoint } from "@openmatsuri/realtime";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { animateMarkerLngLat, cancelMarkerAnimation } from "./animate-marker";
import {
  applyZoomOffset,
  coordsChangedSignificantly,
} from "./fit-view";

const DEFAULT_MARKER_ANIMATION_MS = 2_500;

export type MatsuriMapProps = {
  center?: [number, number];
  zoom?: number;
  trackers?: TrackerRow[];
  locations?: TrackerLocationRow[];
  pois?: PoiRow[];
  routes?: RouteRow[];
  /** Admin などで非表示コースも描画する */
  showHiddenRoutes?: boolean;
  /** 描画中の仮ルート（マップ上のプレビュー用） */
  previewLines?: Array<{ id: string; coordinates: number[][]; color?: string }>;
  onTrackerClick?: (tracker: TrackerRow) => void;
  onPoiClick?: (poi: PoiRow) => void;
  onRouteClick?: (route: RouteRow) => void;
  /** Fired when the map background is clicked (not on markers). */
  onMapClick?: (lngLat: [number, number]) => void;
  /** Show crosshair cursor for click-to-place flows. */
  mapClickMode?: boolean;
  /** Show viewer GPS as a dot on the map (does not move the map viewport). */
  showUserLocation?: boolean;
  /** Center the viewport on the first GPS fix (requires showUserLocation). */
  centerOnUserOnStart?: boolean;
  /** Duration for sliding tracker markers between position updates. */
  markerAnimationMs?: number;
  /** Wait until location fetch finishes before applying the initial viewport. */
  initialViewReady?: boolean;
  /** Zoom adjustment applied when centering on user GPS at start. */
  initialZoomOffset?: number;
  /** Externally supplied user position (e.g. Tracker PWA). */
  userPosition?: { lng: number; lat: number; accuracy?: number } | null;
  /** Keep the map viewport centered on userPosition. */
  centerOnUserPosition?: boolean;
  /** Increment to fly the map to the user's current location. */
  focusUserSignal?: number;
  /** Increment signal to fly the map to a tracker's live position. */
  focusTracker?: { trackerId: string; signal: number } | null;
  /** Zoom level used when focusing on user or tracker (defaults to current zoom). */
  focusZoom?: number;
  /** Aggregated visitor distribution for operator heatmap overlay. */
  heatmapPoints?: Array<{ lng: number; lat: number; weight?: number }>;
  showHeatmap?: boolean;
  /** Heatmap blur strength (5–100). 25 matches the original default spread. */
  heatmapBlur?: number;
  className?: string;
  styleUrl?: string;
};

export type UserMapPosition = {
  lng: number;
  lat: number;
  accuracy?: number;
};

type TrackerMarkerState = {
  marker: maplibregl.Marker;
  animationFrameId?: number;
  targetCoords?: [number, number];
};

export const DEFAULT_HEATMAP_BLUR = 25;

function heatmapBlurScale(blur: number): number {
  const clamped = Math.max(5, Math.min(100, blur));
  return clamped / DEFAULT_HEATMAP_BLUR;
}

function heatmapLayerPaint(blur: number) {
  const scale = heatmapBlurScale(blur);
  const intensityScale = Math.sqrt(scale);
  return {
    "heatmap-weight": ["coalesce", ["get", "weight"], 1],
    "heatmap-intensity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10,
      0.8 * intensityScale,
      16,
      2.5 * intensityScale,
    ],
    "heatmap-color": [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0,
      "rgba(59,130,246,0)",
      0.15,
      "rgba(59,130,246,0.45)",
      0.35,
      "rgba(34,197,94,0.55)",
      0.55,
      "rgba(234,179,8,0.7)",
      0.75,
      "rgba(239,68,68,0.85)",
      1,
      "rgba(185,28,28,0.95)",
    ],
    "heatmap-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10,
      12 * scale,
      16,
      32 * scale,
    ],
    "heatmap-opacity": 0.75,
  };
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getRouteLayerIds(map: maplibregl.Map): string[] {
  return (map.getStyle()?.layers ?? [])
    .filter((layer) => layer.id.startsWith("route-line-"))
    .map((layer) => layer.id);
}

function createTrackerElement(tracker: TrackerRow): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "festival-tracker-marker";
  el.style.cssText = `
    width: 28px; height: 28px; border-radius: 50%;
    background: ${tracker.icon_color ?? "#e11d48"};
    border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    cursor: pointer;
  `;
  el.title = tracker.name;
  return el;
}

function createPoiElement(poi: PoiRow): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "festival-poi-marker";
  wrap.style.cssText =
    "display:flex;flex-direction:column;align-items:center;cursor:pointer;pointer-events:auto;";

  const dot = document.createElement("div");
  dot.dataset.role = "poi-dot";
  dot.style.cssText = `
    width: 18px; height: 18px; border-radius: 4px;
    background: ${POI_KIND_COLORS[poi.kind] ?? POI_KIND_COLORS.other};
    border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.25);
  `;

  const label = document.createElement("div");
  label.dataset.role = "poi-label";
  label.textContent = poi.name;
  label.style.cssText = `
    margin-top: 2px; max-width: 120px; padding: 1px 4px;
    border-radius: 4px; background: rgba(255,255,255,0.92);
    font: 600 10px/1.2 system-ui,sans-serif; color: #0f172a;
    text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  `;

  wrap.appendChild(dot);
  wrap.appendChild(label);
  wrap.title = poi.name;
  return wrap;
}

function updatePoiElement(element: HTMLElement, poi: PoiRow): void {
  element.title = poi.name;
  const dot = element.querySelector<HTMLElement>('[data-role="poi-dot"]');
  const label = element.querySelector<HTMLElement>('[data-role="poi-label"]');
  if (dot) {
    dot.style.background = POI_KIND_COLORS[poi.kind] ?? POI_KIND_COLORS.other;
  }
  if (label) {
    label.textContent = poi.name;
  }
}

export function MatsuriMap({
  center = [135.5023, 34.6937],
  zoom = 14,
  trackers = [],
  locations = [],
  pois = [],
  routes = [],
  showHiddenRoutes = false,
  previewLines = [],
  onTrackerClick,
  onPoiClick,
  onRouteClick,
  onMapClick,
  mapClickMode = false,
  showUserLocation = false,
  centerOnUserOnStart = false,
  markerAnimationMs = DEFAULT_MARKER_ANIMATION_MS,
  initialViewReady = true,
  initialZoomOffset = 0,
  userPosition = null,
  centerOnUserPosition = false,
  focusUserSignal = 0,
  focusTracker = null,
  focusZoom,
  heatmapPoints = [],
  showHeatmap = false,
  heatmapBlur = DEFAULT_HEATMAP_BLUR,
  className,
  styleUrl = typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? DEFAULT_MAP_STYLE
    : DEFAULT_MAP_STYLE,
}: MatsuriMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const trackerMarkersRef = useRef<Map<string, TrackerMarkerState>>(new Map());
  const poiMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const routePopupRef = useRef<maplibregl.Popup | null>(null);
  const routesRef = useRef(routes);
  const onTrackerClickRef = useRef(onTrackerClick);
  const onRouteClickRef = useRef(onRouteClick);
  const onMapClickRef = useRef(onMapClick);
  const mapClickModeRef = useRef(mapClickMode);
  const initialViewAppliedRef = useRef(false);
  const centerOnUserOnStartAppliedRef = useRef(false);
  const mapCenterTargetRef = useRef<[number, number] | null>(null);
  const lastUserCoordsRef = useRef<[number, number] | null>(null);
  const bootViewRef = useRef({ center, zoom });
  const appliedViewRef = useRef({ center, zoom });
  const [ready, setReady] = useState(false);

  onTrackerClickRef.current = onTrackerClick;
  onRouteClickRef.current = onRouteClick;
  onMapClickRef.current = onMapClick;
  mapClickModeRef.current = mapClickMode;
  routesRef.current = routes;

  function easeMapTo(centerCoords: [number, number], targetZoom?: number) {
    const map = mapRef.current;
    if (!map) return;

    mapCenterTargetRef.current = centerCoords;
    map.easeTo({
      center: centerCoords,
      zoom: targetZoom ?? map.getZoom(),
      duration: markerAnimationMs,
      essential: true,
    });
    initialViewAppliedRef.current = true;
  }

  function getTrackerCoords(trackerId: string): [number, number] | null {
    const markerState = trackerMarkersRef.current.get(trackerId);
    if (markerState) {
      const { lng, lat } = markerState.marker.getLngLat();
      return [lng, lat];
    }

    const location = locations.find((loc) => loc.tracker_id === trackerId);
    if (!location) return null;
    return parseGeoPoint(location.location);
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: bootViewRef.current.center,
      zoom: bootViewRef.current.zoom,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => {
      setReady(true);
      map.resize();
    });
    mapRef.current = map;

    return () => {
      initialViewAppliedRef.current = false;
      centerOnUserOnStartAppliedRef.current = false;
      mapCenterTargetRef.current = null;
      trackerMarkersRef.current.forEach((state) => {
        cancelMarkerAnimation(
          () => state.animationFrameId,
          (id) => {
            state.animationFrameId = id;
          },
        );
        state.marker.remove();
      });
      trackerMarkersRef.current.clear();
      poiMarkersRef.current.forEach((m) => m.remove());
      userMarkerRef.current?.remove();
      routePopupRef.current?.remove();
      routePopupRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [styleUrl]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    const clickHandler = (event: maplibregl.MapMouseEvent) => {
      if (!mapClickModeRef.current) {
        const layerIds = getRouteLayerIds(map);
        if (layerIds.length > 0) {
          const features = map.queryRenderedFeatures(event.point, { layers: layerIds });
          const layerId = features[0]?.layer?.id;
          if (layerId?.startsWith("route-line-")) {
            const routeId = layerId.slice("route-line-".length);
            const route = routesRef.current.find((item) => item.id === routeId);
            if (route) {
              routePopupRef.current?.remove();
              routePopupRef.current = new maplibregl.Popup({
                closeButton: true,
                closeOnClick: true,
                offset: 12,
                maxWidth: "240px",
              })
                .setLngLat(event.lngLat)
                .setHTML(
                  `<div style="font:600 13px/1.4 system-ui,sans-serif;color:#0f172a;padding:2px 0;">${escapeHtml(route.name)}</div>`,
                )
                .addTo(map);
              onRouteClickRef.current?.(route);
              return;
            }
          }
        }
      }

      onMapClickRef.current?.([event.lngLat.lng, event.lngLat.lat]);
    };

    const moveHandler = (event: maplibregl.MapMouseEvent) => {
      if (mapClickModeRef.current) return;
      const layerIds = getRouteLayerIds(map);
      const hit =
        layerIds.length > 0 &&
        map.queryRenderedFeatures(event.point, { layers: layerIds }).length > 0;
      map.getCanvas().style.cursor = hit ? "pointer" : "";
    };

    map.on("click", clickHandler);
    map.on("mousemove", moveHandler);
    return () => {
      map.off("click", clickHandler);
      map.off("mousemove", moveHandler);
      map.getCanvas().style.cursor = "";
      routePopupRef.current?.remove();
      routePopupRef.current = null;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || !initialViewReady || initialViewAppliedRef.current) return;

    const map = mapRef.current;
    if (!map) return;

    mapCenterTargetRef.current = center;
    appliedViewRef.current = { center, zoom };
    map.easeTo({
      center,
      zoom,
      duration: markerAnimationMs,
      essential: true,
    });
    initialViewAppliedRef.current = true;
  }, [ready, initialViewReady, center, zoom, markerAnimationMs]);

  useEffect(() => {
    if (!ready || !initialViewReady || !initialViewAppliedRef.current) return;

    const map = mapRef.current;
    if (!map) return;

    const applied = appliedViewRef.current;
    if (
      applied.center[0] === center[0] &&
      applied.center[1] === center[1] &&
      applied.zoom === zoom
    ) {
      return;
    }

    appliedViewRef.current = { center, zoom };
    mapCenterTargetRef.current = center;
    map.easeTo({
      center,
      zoom,
      duration: markerAnimationMs,
      essential: true,
    });
  }, [ready, initialViewReady, center, zoom, markerAnimationMs]);

  useEffect(() => {
    if (!ready) return;
    const container = containerRef.current;
    const map = mapRef.current;
    if (!container || !map) return;

    const resize = () => {
      map.resize();
    };

    resize();
    const observer = new ResizeObserver(() => {
      resize();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const activeRouteIds = new Set<string>();

    routes.forEach((route) => {
      if (!route.is_visible && !showHiddenRoutes) return;
      const coords = parseGeoLineString(route.path);
      if (!coords || coords.length < 2) return;

      const sourceId = `route-${route.id}`;
      const layerId = `route-line-${route.id}`;
      activeRouteIds.add(route.id);

      const feature = {
        type: "Feature" as const,
        properties: { name: route.name, routeId: route.id },
        geometry: { type: "LineString" as const, coordinates: coords },
      };

      const existing = map.getSource(sourceId);
      if (existing && "setData" in existing) {
        (existing as maplibregl.GeoJSONSource).setData(feature);
      } else {
        map.addSource(sourceId, { type: "geojson", data: feature });
        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": route.is_visible ? "#6366f1" : "#94a3b8",
            "line-width": 4,
            "line-opacity": route.is_visible ? 0.8 : 0.45,
            ...(route.is_visible ? {} : { "line-dasharray": [2, 2] }),
          },
        });
      }

      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, "line-color", route.is_visible ? "#6366f1" : "#94a3b8");
        map.setPaintProperty(layerId, "line-opacity", route.is_visible ? 0.8 : 0.45);
        if (route.is_visible) {
          map.setPaintProperty(layerId, "line-dasharray", [1, 0]);
        } else {
          map.setPaintProperty(layerId, "line-dasharray", [2, 2]);
        }
      }
    });

    for (const layer of map.getStyle()?.layers ?? []) {
      if (!layer.id.startsWith("route-line-")) continue;
      const routeId = layer.id.slice("route-line-".length);
      if (!activeRouteIds.has(routeId)) {
        if (map.getLayer(layer.id)) map.removeLayer(layer.id);
        const sourceId = `route-${routeId}`;
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }
    }
  }, [routes, ready, showHiddenRoutes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const activePreviewIds = new Set(previewLines.map((line) => line.id));

    previewLines.forEach((line) => {
      if (line.coordinates.length < 2) return;

      const sourceId = `preview-route-${line.id}`;
      const layerId = `preview-route-line-${line.id}`;
      const feature = {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: line.coordinates },
      };

      const existing = map.getSource(sourceId);
      if (existing && "setData" in existing) {
        (existing as maplibregl.GeoJSONSource).setData(feature);
      } else {
        map.addSource(sourceId, { type: "geojson", data: feature });
        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": line.color ?? "#f59e0b",
            "line-width": 5,
            "line-opacity": 0.9,
          },
        });
      }
    });

    for (const layer of map.getStyle()?.layers ?? []) {
      if (!layer.id.startsWith("preview-route-line-")) continue;
      const previewId = layer.id.slice("preview-route-line-".length);
      if (!activePreviewIds.has(previewId)) {
        if (map.getLayer(layer.id)) map.removeLayer(layer.id);
        const sourceId = `preview-route-${previewId}`;
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }
    }
  }, [previewLines, ready]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    const trackerMap = new Map(trackers.map((t) => [t.id, t]));
    const activeTrackerIds = new Set<string>();

    locations.forEach((loc) => {
      const tracker = trackerMap.get(loc.tracker_id);
      if (!tracker) return;
      const coords = parseGeoPoint(loc.location);
      if (!coords) return;

      activeTrackerIds.add(loc.tracker_id);

      let state = trackerMarkersRef.current.get(loc.tracker_id);
      if (!state) {
        const el = createTrackerElement(tracker);
        const marker = new maplibregl.Marker({ element: el }).setLngLat(coords).addTo(map);
        el.addEventListener("click", () => onTrackerClickRef.current?.(tracker));
        state = { marker, targetCoords: coords };
        trackerMarkersRef.current.set(loc.tracker_id, state);
        return;
      }

      const prevTarget = state.targetCoords;
      if (prevTarget && prevTarget[0] === coords[0] && prevTarget[1] === coords[1]) return;

      state.targetCoords = coords;
      animateMarkerLngLat(
        state.marker,
        coords,
        markerAnimationMs,
        () => state!.animationFrameId,
        (id) => {
          state!.animationFrameId = id;
        },
      );
    });

    trackerMarkersRef.current.forEach((state, trackerId) => {
      if (activeTrackerIds.has(trackerId)) return;
      cancelMarkerAnimation(
        () => state.animationFrameId,
        (id) => {
          state.animationFrameId = id;
        },
      );
      state.marker.remove();
      trackerMarkersRef.current.delete(trackerId);
    });
  }, [locations, trackers, ready, markerAnimationMs]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    trackers.forEach((tracker) => {
      const state = trackerMarkersRef.current.get(tracker.id);
      if (!state) return;
      const el = state.marker.getElement();
      el.style.background = tracker.icon_color ?? "#e11d48";
      el.title = tracker.name;
    });
  }, [trackers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const sourceId = "viewer-heatmap-source";
    const layerId = "viewer-heatmap-layer";

    if (!showHeatmap || heatmapPoints.length === 0) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      return;
    }

    const featureCollection = {
      type: "FeatureCollection" as const,
      features: heatmapPoints.map((point, index) => ({
        type: "Feature" as const,
        id: index,
        properties: { weight: point.weight ?? 1 },
        geometry: {
          type: "Point" as const,
          coordinates: [point.lng, point.lat],
        },
      })),
    };

    const paint = heatmapLayerPaint(heatmapBlur);

    const existing = map.getSource(sourceId);
    if (existing && "setData" in existing) {
      (existing as maplibregl.GeoJSONSource).setData(featureCollection);
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, "heatmap-radius", paint["heatmap-radius"]);
        map.setPaintProperty(layerId, "heatmap-intensity", paint["heatmap-intensity"]);
      }
      return;
    }

    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    map.addSource(sourceId, { type: "geojson", data: featureCollection });
    map.addLayer({
      id: layerId,
      type: "heatmap",
      source: sourceId,
      paint: paint as maplibregl.HeatmapLayerSpecification["paint"],
    });
  }, [ready, showHeatmap, heatmapPoints, heatmapBlur]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    const activeIds = new Set(pois.map((poi) => poi.id));
    for (const [poiId, marker] of poiMarkersRef.current) {
      if (!activeIds.has(poiId)) {
        marker.remove();
        poiMarkersRef.current.delete(poiId);
      }
    }

    pois.forEach((poi) => {
      const coords = parseGeoPoint(poi.location);
      if (!coords) return;

      const existing = poiMarkersRef.current.get(poi.id);
      if (existing) {
        existing.setLngLat(coords);
        updatePoiElement(existing.getElement(), poi);
        return;
      }

      const el = createPoiElement(poi);
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(coords)
        .addTo(map);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        onPoiClick?.(poi);
      });
      poiMarkersRef.current.set(poi.id, marker);
    });
  }, [pois, ready, onPoiClick]);

  useEffect(() => {
    if (!ready || userPosition) return;

    const map = mapRef.current;
    if (!map) return;

    if (!showUserLocation || !navigator.geolocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        lastUserCoordsRef.current = coords;
        if (!userMarkerRef.current) {
          const el = document.createElement("div");
          el.style.cssText = `
            width: 16px; height: 16px; border-radius: 50%;
            background: #4285f4; border: 2.5px solid white;
            box-shadow: 0 0 0 6px rgba(66, 133, 244, 0.2);
          `;
          el.title = "現在地";
          userMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat(coords)
            .addTo(map);
        } else {
          userMarkerRef.current.setLngLat(coords);
        }

        if (centerOnUserOnStart && !centerOnUserOnStartAppliedRef.current) {
          centerOnUserOnStartAppliedRef.current = true;
          mapCenterTargetRef.current = coords;
          map.easeTo({
            center: coords,
            zoom: focusZoom ?? applyZoomOffset(zoom, initialZoomOffset),
            duration: markerAnimationMs,
            essential: true,
          });
          initialViewAppliedRef.current = true;
        }
      },
      undefined,
      { enableHighAccuracy: true, maximumAge: 5000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
    };
  }, [
    showUserLocation,
    centerOnUserOnStart,
    ready,
    userPosition,
    focusZoom,
    zoom,
    initialZoomOffset,
    markerAnimationMs,
  ]);

  useEffect(() => {
    if (!ready || !userPosition) return;

    const map = mapRef.current;
    if (!map) return;

    const coords: [number, number] = [userPosition.lng, userPosition.lat];
    lastUserCoordsRef.current = coords;
    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 16px; height: 16px; border-radius: 50%;
        background: #2563eb; border: 3px solid white;
        box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25);
      `;
      el.title = "現在地";
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat(coords);
    }

    if (!centerOnUserPosition) return;

    const previousCenter = mapCenterTargetRef.current;
    if (previousCenter && !coordsChangedSignificantly(previousCenter, coords)) return;

    mapCenterTargetRef.current = coords;
    map.easeTo({
      center: coords,
      zoom: initialViewAppliedRef.current ? map.getZoom() : zoom,
      duration: markerAnimationMs,
      essential: true,
    });
    initialViewAppliedRef.current = true;
  }, [ready, userPosition, centerOnUserPosition, zoom, markerAnimationMs]);

  useEffect(() => {
    if (!ready || focusUserSignal === 0) return;

    const map = mapRef.current;
    if (!map) return;

    const flyToCoords = (coords: [number, number]) => {
      easeMapTo(coords, focusZoom);
    };

    if (userMarkerRef.current) {
      const { lng, lat } = userMarkerRef.current.getLngLat();
      flyToCoords([lng, lat]);
      return;
    }

    if (lastUserCoordsRef.current) {
      flyToCoords(lastUserCoordsRef.current);
      return;
    }

    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        lastUserCoordsRef.current = coords;
        flyToCoords(coords);
      },
      undefined,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
  }, [ready, focusUserSignal, focusZoom, markerAnimationMs]);

  useEffect(() => {
    if (!ready || !focusTracker || focusTracker.signal === 0) return;

    const coords = getTrackerCoords(focusTracker.trackerId);
    if (!coords) return;

    easeMapTo(coords, focusZoom);
  }, [ready, focusTracker, focusZoom, locations, markerAnimationMs]);

  return (
    <div
      ref={containerRef}
      className={[className, mapClickMode ? "cursor-crosshair" : ""].filter(Boolean).join(" ")}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

export { parseGeoPoint, parseGeoLineString };
