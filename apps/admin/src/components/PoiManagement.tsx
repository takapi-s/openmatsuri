"use client";

import { POI_KIND_COLORS, POI_KIND_LABELS, type PoiKind, toGeographyEwkt } from "@openmatsuri/config";
import { MatsuriMap } from "@openmatsuri/map";
import { parseGeoPoint } from "@openmatsuri/realtime";
import type { EventRow, PoiRow } from "@openmatsuri/realtime/client";
import { AdminCard } from "@/components/AdminCard";
import { Button, Input, Select } from "@openmatsuri/ui";
import { createClient } from "@/lib/supabase/client";
import { parseCenter } from "@/lib/map";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  event: EventRow;
  initialPois: PoiRow[];
};

type PlacementMode = "idle" | "new" | "move";

type CoordDraft = {
  lng: string;
  lat: string;
};

function coordsFromPoi(poi: PoiRow): CoordDraft {
  const coords = parseGeoPoint(poi.location);
  return {
    lng: coords ? coords[0].toFixed(6) : "",
    lat: coords ? coords[1].toFixed(6) : "",
  };
}

function parseCoordDraft(draft: CoordDraft): [number, number] | null {
  const lng = Number.parseFloat(draft.lng);
  const lat = Number.parseFloat(draft.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return [lng, lat];
}

const POI_KIND_ORDER = Object.keys(POI_KIND_LABELS) as PoiKind[];

function isPoiDirty(
  poi: PoiRow,
  draftNames: Record<string, string>,
  draftKinds: Record<string, PoiKind>,
  draftCoords: Record<string, CoordDraft>,
): boolean {
  const name = draftNames[poi.id] ?? poi.name;
  const kind = draftKinds[poi.id] ?? poi.kind;
  const coords = draftCoords[poi.id] ?? coordsFromPoi(poi);
  const savedCoords = coordsFromPoi(poi);

  return (
    name !== poi.name ||
    kind !== poi.kind ||
    coords.lng !== savedCoords.lng ||
    coords.lat !== savedCoords.lat
  );
}

export function PoiManagement({ event, initialPois }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [pois, setPois] = useState(initialPois);
  const [newPoiName, setNewPoiName] = useState("");
  const [newPoiKind, setNewPoiKind] = useState<PoiKind>("toilet");
  const [placementMode, setPlacementMode] = useState<PlacementMode>("idle");
  const [movingPoiId, setMovingPoiId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftNames, setDraftNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialPois.map((poi) => [poi.id, poi.name])),
  );
  const [draftKinds, setDraftKinds] = useState<Record<string, PoiKind>>(() =>
    Object.fromEntries(initialPois.map((poi) => [poi.id, poi.kind])),
  );
  const [draftCoords, setDraftCoords] = useState<Record<string, CoordDraft>>(() =>
    Object.fromEntries(initialPois.map((poi) => [poi.id, coordsFromPoi(poi)])),
  );

  const mapCenter = parseCenter(event.map_center);

  useEffect(() => {
    setPois(initialPois);
  }, [initialPois]);

  useEffect(() => {
    setDraftNames((prev) => {
      const next = { ...prev };
      for (const poi of pois) {
        if (!(poi.id in next)) next[poi.id] = poi.name;
      }
      return next;
    });
    setDraftKinds((prev) => {
      const next = { ...prev };
      for (const poi of pois) {
        if (!(poi.id in next)) next[poi.id] = poi.kind;
      }
      return next;
    });
    setDraftCoords((prev) => {
      const next = { ...prev };
      for (const poi of pois) {
        if (!(poi.id in next)) next[poi.id] = coordsFromPoi(poi);
      }
      return next;
    });
  }, [pois]);

  useEffect(() => {
    const channel = supabase
      .channel(`admin-pois:${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pois",
          filter: `event_id=eq.${event.id}`,
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
          setDraftNames((prev) => ({ ...prev, [row.id]: row.name }));
          setDraftKinds((prev) => ({ ...prev, [row.id]: row.kind }));
          setDraftCoords((prev) => ({ ...prev, [row.id]: coordsFromPoi(row) }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, event.id]);

  const cancelPlacement = useCallback(() => {
    setPlacementMode("idle");
    setMovingPoiId(null);
  }, []);

  const startNewPlacement = useCallback(() => {
    if (!newPoiName.trim()) {
      setError("先に POI 名を入力してください。");
      return;
    }
    setError(null);
    setPlacementMode("new");
    setMovingPoiId(null);
  }, [newPoiName]);

  const startMovePlacement = useCallback((poiId: string) => {
    setError(null);
    setPlacementMode("move");
    setMovingPoiId(poiId);
  }, []);

  const handleMapClick = useCallback(
    async (lngLat: [number, number]) => {
      if (placementMode === "idle") return;

      setError(null);
      const [lng, lat] = lngLat;

      if (placementMode === "new") {
        if (!newPoiName.trim()) return;

        const { data, error: insertError } = await supabase
          .from("pois")
          .insert({
            event_id: event.id,
            name: newPoiName.trim(),
            kind: newPoiKind,
            location: toGeographyEwkt(lng, lat),
          })
          .select()
          .single();

        if (insertError) {
          setError(insertError.message);
          return;
        }

        if (data) {
          setPois((prev) => [...prev, data]);
          setDraftNames((prev) => ({ ...prev, [data.id]: data.name }));
          setDraftKinds((prev) => ({ ...prev, [data.id]: data.kind }));
          setDraftCoords((prev) => ({ ...prev, [data.id]: coordsFromPoi(data) }));
          setNewPoiName("");
          cancelPlacement();
        }
        return;
      }

      if (placementMode === "move" && movingPoiId) {
        const { data, error: updateError } = await supabase
          .from("pois")
          .update({ location: toGeographyEwkt(lng, lat) })
          .eq("id", movingPoiId)
          .select()
          .single();

        if (updateError) {
          setError(updateError.message);
          return;
        }

        if (data) {
          setPois((prev) => prev.map((poi) => (poi.id === movingPoiId ? data : poi)));
          setDraftCoords((prev) => ({ ...prev, [data.id]: coordsFromPoi(data) }));
          cancelPlacement();
        }
      }
    },
    [
      placementMode,
      newPoiName,
      newPoiKind,
      movingPoiId,
      supabase,
      event.id,
      cancelPlacement,
    ],
  );

  const savePoi = useCallback(
    async (poiId: string) => {
      const poi = pois.find((item) => item.id === poiId);
      if (!poi) return;

      const name = draftNames[poiId]?.trim();
      const kind = draftKinds[poiId] ?? poi.kind;
      const coords = parseCoordDraft(draftCoords[poiId] ?? coordsFromPoi(poi));

      if (!name) {
        setError("POI 名を入力してください。");
        return;
      }
      if (!coords) {
        setError("有効な経度・緯度を入力してください。");
        return;
      }

      setError(null);
      const [lng, lat] = coords;
      const { data, error: updateError } = await supabase
        .from("pois")
        .update({
          name,
          kind,
          location: toGeographyEwkt(lng, lat),
        })
        .eq("id", poiId)
        .select()
        .single();

      if (updateError) {
        setError(updateError.message);
        return;
      }

      if (data) {
        setPois((prev) => prev.map((item) => (item.id === poiId ? data : item)));
        setDraftNames((prev) => ({ ...prev, [poiId]: data.name }));
        setDraftKinds((prev) => ({ ...prev, [poiId]: data.kind }));
        setDraftCoords((prev) => ({ ...prev, [poiId]: coordsFromPoi(data) }));
        if (movingPoiId === poiId) cancelPlacement();
      }
    },
    [pois, draftNames, draftKinds, draftCoords, supabase, movingPoiId, cancelPlacement],
  );

  const deletePoi = useCallback(
    async (poiId: string) => {
      if (!window.confirm("この POI を削除しますか？")) return;
      setError(null);

      const { error: deleteError } = await supabase.from("pois").delete().eq("id", poiId);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      setPois((prev) => prev.filter((poi) => poi.id !== poiId));
      if (movingPoiId === poiId) cancelPlacement();
    },
    [supabase, movingPoiId, cancelPlacement],
  );

  const placementHint =
    placementMode === "new"
      ? "マップ上の配置したい場所をクリックしてください。"
      : placementMode === "move"
        ? "新しい位置をマップ上でクリックしてください。"
        : "名前を入力して「マップに配置」を押すか、一覧から「位置を変更」を選んでください。";

  const kindSelectOptions = Object.entries(POI_KIND_LABELS).map(([k, v]) => (
    <option key={k} value={k}>
      {v}
    </option>
  ));

  const groupedPois = useMemo(() => {
    const groups = new Map<PoiKind, PoiRow[]>();
    for (const kind of POI_KIND_ORDER) {
      groups.set(kind, []);
    }
    for (const poi of pois) {
      const kind = draftKinds[poi.id] ?? poi.kind;
      groups.get(kind)?.push(poi);
    }
    return POI_KIND_ORDER.map((kind) => ({
      kind,
      pois: groups.get(kind) ?? [],
    })).filter((group) => group.pois.length > 0);
  }, [pois, draftKinds]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">POI 管理</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          トイレ・駐車場などをマップ上にクリックして配置します。Viewer にも同じ位置で表示されます。
        </p>
      </div>

      <AdminCard title="POI 一覧">
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="w-28">
            <label className="mb-1 block text-xs font-medium text-slate-500">種別</label>
            <Select value={newPoiKind} onChange={(e) => setNewPoiKind(e.target.value as PoiKind)}>
              {kindSelectOptions}
            </Select>
          </div>
          <div className="min-w-[10rem] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">名前</label>
            <Input
              placeholder="POI 名"
              value={newPoiName}
              onChange={(e) => setNewPoiName(e.target.value)}
            />
          </div>
          <Button
            variant={placementMode === "new" ? "primary" : "secondary"}
            onClick={placementMode === "new" ? cancelPlacement : startNewPlacement}
          >
            {placementMode === "new" ? "配置をキャンセル" : "マップに配置"}
          </Button>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                <th className="pb-2 pr-2 font-medium">名前</th>
                <th className="w-28 pb-2 pr-2 font-medium">経度</th>
                <th className="w-28 pb-2 pr-2 font-medium">緯度</th>
                <th className="min-w-[19rem] pb-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {groupedPois.map((group) => (
                <Fragment key={group.kind}>
                  <tr className="bg-slate-50">
                    <td colSpan={4} className="py-2 pr-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <span
                          className="inline-block size-2.5 shrink-0 rounded-sm"
                          style={{ background: POI_KIND_COLORS[group.kind] }}
                          aria-hidden
                        />
                        <span>{POI_KIND_LABELS[group.kind]}</span>
                        <span className="font-medium text-slate-400">{group.pois.length} 件</span>
                      </div>
                    </td>
                  </tr>
                  {group.pois.map((poi) => {
                    const coords = draftCoords[poi.id] ?? coordsFromPoi(poi);
                    const dirty = isPoiDirty(poi, draftNames, draftKinds, draftCoords);

                    return (
                      <tr
                        key={poi.id}
                        className={`border-b border-slate-100 align-middle ${
                          movingPoiId === poi.id ? "bg-indigo-50" : ""
                        }`}
                      >
                        <td className="py-2 pr-2">
                          <Input
                            value={draftNames[poi.id] ?? poi.name}
                            onChange={(e) =>
                              setDraftNames((prev) => ({ ...prev, [poi.id]: e.target.value }))
                            }
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            value={coords.lng}
                            onChange={(e) =>
                              setDraftCoords((prev) => ({
                                ...prev,
                                [poi.id]: { ...coords, lng: e.target.value },
                              }))
                            }
                            inputMode="decimal"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <Input
                            value={coords.lat}
                            onChange={(e) =>
                              setDraftCoords((prev) => ({
                                ...prev,
                                [poi.id]: { ...coords, lat: e.target.value },
                              }))
                            }
                            inputMode="decimal"
                          />
                        </td>
                        <td className="whitespace-nowrap py-2">
                          <div className="flex flex-nowrap items-center gap-1">
                            <Select
                              value={draftKinds[poi.id] ?? poi.kind}
                              onChange={(e) =>
                                setDraftKinds((prev) => ({
                                  ...prev,
                                  [poi.id]: e.target.value as PoiKind,
                                }))
                              }
                              title="種別を変更"
                              style={{ width: "5.5rem", minWidth: "5.5rem" }}
                            >
                              {kindSelectOptions}
                            </Select>
                            <Button
                              variant="secondary"
                              className="!px-2.5 !py-1.5 !text-xs"
                              onClick={() => savePoi(poi.id)}
                              disabled={!dirty}
                            >
                              保存
                            </Button>
                            <Button
                              variant={movingPoiId === poi.id ? "primary" : "secondary"}
                              className="!px-2.5 !py-1.5 !text-xs"
                              onClick={() =>
                                movingPoiId === poi.id
                                  ? cancelPlacement()
                                  : startMovePlacement(poi.id)
                              }
                            >
                              {movingPoiId === poi.id ? "取消" : "位置"}
                            </Button>
                            <Button
                              variant="danger"
                              className="!px-2.5 !py-1.5 !text-xs"
                              onClick={() => deletePoi(poi.id)}
                            >
                              削除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
          {pois.length === 0 && (
            <p className="py-4 text-sm text-slate-500">POI がまだ登録されていません。</p>
          )}
        </div>
      </AdminCard>

      <AdminCard title="配置マップ">
        <p
          className={`mb-3 flex min-h-12 items-center rounded-md px-3 py-2 text-sm ${
            placementMode !== "idle"
              ? "bg-indigo-50 font-medium text-indigo-800"
              : "bg-slate-50 text-slate-600"
          }`}
        >
          {placementHint}
        </p>
        <div
          className={`relative h-[min(50vh,480px)] w-full overflow-hidden rounded-lg border border-slate-200 ${
            placementMode !== "idle" ? "cursor-crosshair" : ""
          }`}
        >
          <MatsuriMap
            center={mapCenter}
            zoom={event.map_zoom}
            pois={pois}
            initialViewReady
            mapClickMode={placementMode !== "idle"}
            onMapClick={handleMapClick}
            className="absolute inset-0"
          />
        </div>
      </AdminCard>
    </div>
  );
}
