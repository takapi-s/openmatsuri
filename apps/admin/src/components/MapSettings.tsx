"use client";

import { toGeographyEwkt } from "@openmatsuri/config";
import { MatsuriMap } from "@openmatsuri/map";
import type { EventRow, PoiRow } from "@openmatsuri/realtime/client";
import { AdminCard } from "@/components/AdminCard";
import { parseCenter } from "@/lib/map";
import { Button, Input } from "@openmatsuri/ui";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  event: EventRow;
};

type CoordDraft = {
  lng: string;
  lat: string;
};

function coordsToDraft([lng, lat]: [number, number]): CoordDraft {
  return { lng: lng.toFixed(6), lat: lat.toFixed(6) };
}

function parseCoordDraft(draft: CoordDraft): [number, number] | null {
  const lng = Number.parseFloat(draft.lng);
  const lat = Number.parseFloat(draft.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return [lng, lat];
}

export function MapSettings({ event }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const savedCenter = useMemo(() => parseCenter(event.map_center), [event.map_center]);
  const savedCoords = useMemo(() => coordsToDraft(savedCenter), [savedCenter]);

  const [draftCoords, setDraftCoords] = useState<CoordDraft>(savedCoords);
  const [draftZoom, setDraftZoom] = useState(event.map_zoom);
  const [draftRetentionDays, setDraftRetentionDays] = useState(
    event.viewer_location_retention_days ?? 365,
  );
  const [placementMode, setPlacementMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDraftCoords(savedCoords);
    setDraftZoom(event.map_zoom);
    setDraftRetentionDays(event.viewer_location_retention_days ?? 365);
  }, [savedCoords.lng, savedCoords.lat, event.map_zoom, event.viewer_location_retention_days]);

  const draftCenter = useMemo(
    () => parseCoordDraft(draftCoords) ?? savedCenter,
    [draftCoords, savedCenter],
  );

  const isDirty =
    draftCoords.lng !== savedCoords.lng ||
    draftCoords.lat !== savedCoords.lat ||
    draftZoom !== event.map_zoom ||
    draftRetentionDays !== (event.viewer_location_retention_days ?? 365);

  const centerMarker = useMemo((): PoiRow | null => {
    const coords = parseCoordDraft(draftCoords);
    if (!coords) return null;
    return {
      id: "__map_center__",
      event_id: event.id,
      name: "初期表示の中心",
      kind: "other",
      location: { type: "Point", coordinates: coords },
      description: null,
      created_at: "",
    };
  }, [draftCoords, event.id]);

  const handleMapClick = useCallback((lngLat: [number, number]) => {
    setDraftCoords(coordsToDraft(lngLat));
    setPlacementMode(false);
    setError(null);
  }, []);

  const save = useCallback(async () => {
    const coords = parseCoordDraft(draftCoords);
    if (!coords) {
      setError("経度・緯度の形式が正しくありません。");
      return;
    }
    if (draftZoom < 1 || draftZoom > 20) {
      setError("ズームは 1〜20 の範囲で指定してください。");
      return;
    }
    if (draftRetentionDays < 1 || draftRetentionDays > 3650) {
      setError("来場者位置の保持日数は 1〜3650 の範囲で指定してください。");
      return;
    }

    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("events")
      .update({
        map_center: toGeographyEwkt(coords[0], coords[1]),
        map_zoom: draftZoom,
        viewer_location_retention_days: draftRetentionDays,
      })
      .eq("id", event.id);
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNotice("マップの初期表示を保存しました。");
    setPlacementMode(false);
    router.refresh();
    window.setTimeout(() => setNotice(null), 4000);
  }, [supabase, event.id, draftCoords, draftZoom, draftRetentionDays, router]);

  const resetDraft = useCallback(() => {
    setDraftCoords(savedCoords);
    setDraftZoom(event.map_zoom);
    setDraftRetentionDays(event.viewer_location_retention_days ?? 365);
    setPlacementMode(false);
    setError(null);
  }, [savedCoords, event.map_zoom, event.viewer_location_retention_days]);

  const placementHint = placementMode
    ? "マップをクリックして初期表示の中心を設定してください。"
    : "「中心を設定」を押すと、マップ上のクリックで中心座標を指定できます。";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">マップ設定</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Viewer の初期表示と、来場者位置データの保持期間を設定します。
        </p>
      </div>

      {notice && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <AdminCard title="初期表示">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm">
              <span className="font-semibold text-slate-900">経度 (lng)</span>
              <Input
                type="text"
                inputMode="decimal"
                value={draftCoords.lng}
                onChange={(e) => setDraftCoords((prev) => ({ ...prev, lng: e.target.value }))}
                className="mt-1 font-mono"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-slate-900">緯度 (lat)</span>
              <Input
                type="text"
                inputMode="decimal"
                value={draftCoords.lat}
                onChange={(e) => setDraftCoords((prev) => ({ ...prev, lat: e.target.value }))}
                className="mt-1 font-mono"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-slate-900">ズーム</span>
              <Input
                type="number"
                min={1}
                max={20}
                value={draftZoom}
                onChange={(e) => setDraftZoom(Number.parseInt(e.target.value, 10) || event.map_zoom)}
                className="mt-1"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold text-slate-900">来場者位置 保持日数</span>
              <Input
                type="number"
                min={1}
                max={3650}
                value={draftRetentionDays}
                onChange={(e) =>
                  setDraftRetentionDays(
                    Number.parseInt(e.target.value, 10) ||
                      (event.viewer_location_retention_days ?? 365),
                  )
                }
                className="mt-1"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={placementMode ? "primary" : "secondary"}
              onClick={() => setPlacementMode((active) => !active)}
            >
              {placementMode ? "設定をキャンセル" : "中心を設定"}
            </Button>
            <Button onClick={() => void save()} disabled={!isDirty || saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
            <Button variant="secondary" onClick={resetDraft} disabled={!isDirty || saving}>
              リセット
            </Button>
          </div>
        </div>
      </AdminCard>

      <AdminCard title="プレビュー">
        <p
          className={`mb-3 flex min-h-12 items-center rounded-md px-3 py-2 text-sm ${
            placementMode
              ? "bg-indigo-50 font-medium text-indigo-800"
              : "bg-slate-50 text-slate-600"
          }`}
        >
          {placementHint}
        </p>
        <div
          className={`relative h-[min(60vh,560px)] w-full overflow-hidden rounded-lg border border-slate-200 ${
            placementMode ? "cursor-crosshair" : ""
          }`}
        >
          <MatsuriMap
            center={draftCenter}
            zoom={draftZoom}
            pois={!placementMode && centerMarker ? [centerMarker] : []}
            initialViewReady
            markerAnimationMs={300}
            mapClickMode={placementMode}
            onMapClick={handleMapClick}
            className="absolute inset-0"
          />
        </div>
      </AdminCard>
    </div>
  );
}
