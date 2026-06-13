"use client";

import { toGeographyLineStringEwkt } from "@openmatsuri/config";
import { MatsuriMap } from "@openmatsuri/map";
import { parseGeoLineString } from "@openmatsuri/realtime";
import type { EventRow, RouteRow } from "@openmatsuri/realtime/client";
import { AdminCard } from "@/components/AdminCard";
import { Badge, Button, Input } from "@openmatsuri/ui";
import { createClient } from "@/lib/supabase/client";
import { parseCenter } from "@/lib/map";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  event: EventRow;
  initialRoutes: RouteRow[];
};

type DrawMode = "idle" | "new" | "edit";

type RouteGroup = {
  key: "visible" | "hidden";
  label: string;
  color: string;
  routes: RouteRow[];
};

function coordsFromRoute(route: RouteRow): [number, number][] {
  return (parseGeoLineString(route.path) ?? []) as [number, number][];
}

function isRouteNameDirty(route: RouteRow, draftNames: Record<string, string>): boolean {
  return (draftNames[route.id] ?? route.name) !== route.name;
}

export function RouteManagement({ event, initialRoutes }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [routes, setRoutes] = useState(initialRoutes);
  const [newRouteName, setNewRouteName] = useState("");
  const [drawMode, setDrawMode] = useState<DrawMode>("idle");
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draftNames, setDraftNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialRoutes.map((route) => [route.id, route.name])),
  );

  const mapCenter = parseCenter(event.map_center);

  useEffect(() => {
    setRoutes(initialRoutes);
  }, [initialRoutes]);

  useEffect(() => {
    setDraftNames((prev) => {
      const next = { ...prev };
      for (const route of routes) {
        if (!(route.id in next)) next[route.id] = route.name;
      }
      return next;
    });
  }, [routes]);

  useEffect(() => {
    const channel = supabase
      .channel(`admin-routes:${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "routes",
          filter: `event_id=eq.${event.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as RouteRow;
            setRoutes((prev) => prev.filter((route) => route.id !== deleted.id));
            return;
          }

          const row = payload.new as RouteRow;
          setRoutes((prev) => {
            const index = prev.findIndex((route) => route.id === row.id);
            if (index >= 0) {
              const next = [...prev];
              next[index] = row;
              return next;
            }
            return [...prev, row];
          });
          setDraftNames((prev) => ({ ...prev, [row.id]: row.name }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, event.id]);

  const cancelDrawing = useCallback(() => {
    setDrawMode("idle");
    setEditingRouteId(null);
    setDrawingPoints([]);
  }, []);

  const startNewDrawing = useCallback(() => {
    if (!newRouteName.trim()) {
      setError("先にコース名を入力してください。");
      return;
    }
    setError(null);
    setDrawMode("new");
    setEditingRouteId(null);
    setDrawingPoints([]);
  }, [newRouteName]);

  const startEditDrawing = useCallback((routeId: string) => {
    setError(null);
    setDrawMode("edit");
    setEditingRouteId(routeId);
    setDrawingPoints([]);
  }, []);

  const handleMapClick = useCallback(
    (lngLat: [number, number]) => {
      if (drawMode === "idle") return;
      setDrawingPoints((prev) => [...prev, lngLat]);
    },
    [drawMode],
  );

  const undoLastPoint = useCallback(() => {
    setDrawingPoints((prev) => prev.slice(0, -1));
  }, []);

  const saveNewRoute = useCallback(async () => {
    const name = newRouteName.trim();
    if (!name) {
      setError("コース名を入力してください。");
      return;
    }
    if (drawingPoints.length < 2) {
      setError("コースは2点以上必要です。マップをクリックして経路を追加してください。");
      return;
    }

    setError(null);
    const { data, error: insertError } = await supabase
      .from("routes")
      .insert({
        event_id: event.id,
        name,
        path: toGeographyLineStringEwkt(drawingPoints),
        is_visible: true,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    if (data) {
      setRoutes((prev) => [...prev, data]);
      setDraftNames((prev) => ({ ...prev, [data.id]: data.name }));
      setNewRouteName("");
      cancelDrawing();
    }
  }, [newRouteName, drawingPoints, supabase, event.id, cancelDrawing]);

  const saveEditedRoute = useCallback(async () => {
    if (!editingRouteId) return;
    if (drawingPoints.length < 2) {
      setError("コースは2点以上必要です。マップをクリックして経路を追加してください。");
      return;
    }

    setError(null);
    const { data, error: updateError } = await supabase
      .from("routes")
      .update({ path: toGeographyLineStringEwkt(drawingPoints) })
      .eq("id", editingRouteId)
      .select()
      .single();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (data) {
      setRoutes((prev) => prev.map((route) => (route.id === editingRouteId ? data : route)));
      cancelDrawing();
    }
  }, [editingRouteId, drawingPoints, supabase, cancelDrawing]);

  const saveRouteName = useCallback(
    async (routeId: string) => {
      const name = draftNames[routeId]?.trim();
      if (!name) {
        setError("コース名を入力してください。");
        return;
      }

      setError(null);
      const { data, error: updateError } = await supabase
        .from("routes")
        .update({ name })
        .eq("id", routeId)
        .select()
        .single();

      if (updateError) {
        setError(updateError.message);
        return;
      }

      if (data) {
        setRoutes((prev) => prev.map((route) => (route.id === routeId ? data : route)));
        setDraftNames((prev) => ({ ...prev, [routeId]: data.name }));
      }
    },
    [draftNames, supabase],
  );

  const toggleVisibility = useCallback(
    async (route: RouteRow) => {
      setError(null);
      const { data, error: updateError } = await supabase
        .from("routes")
        .update({ is_visible: !route.is_visible })
        .eq("id", route.id)
        .select()
        .single();

      if (updateError) {
        setError(updateError.message);
        return;
      }

      if (data) {
        setRoutes((prev) => prev.map((item) => (item.id === route.id ? data : item)));
      }
    },
    [supabase],
  );

  const deleteRoute = useCallback(
    async (routeId: string) => {
      if (!window.confirm("このコースを削除しますか？")) return;
      setError(null);

      const { error: deleteError } = await supabase.from("routes").delete().eq("id", routeId);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      setRoutes((prev) => prev.filter((route) => route.id !== routeId));
      if (editingRouteId === routeId) cancelDrawing();
    },
    [supabase, editingRouteId, cancelDrawing],
  );

  const visibleCount = useMemo(
    () => routes.filter((route) => route.is_visible).length,
    [routes],
  );

  const groupedRoutes = useMemo((): RouteGroup[] => {
    return [
      {
        key: "visible",
        label: "表示中",
        color: "#16a34a",
        routes: routes.filter((route) => route.is_visible),
      },
      {
        key: "hidden",
        label: "非表示",
        color: "#64748b",
        routes: routes.filter((route) => !route.is_visible),
      },
    ].filter((group) => group.routes.length > 0);
  }, [routes]);

  const previewLines = useMemo(() => {
    if (drawMode === "idle" || drawingPoints.length < 2) return [];
    return [{ id: "drawing", coordinates: drawingPoints, color: "#f59e0b" }];
  }, [drawMode, drawingPoints]);

  const drawingHint =
    drawMode === "new"
      ? `マップをクリックして経路を追加してください（${drawingPoints.length} 点）。2点以上で保存できます。`
      : drawMode === "edit"
        ? `新しい経路をマップ上でクリックして描き直してください（${drawingPoints.length} 点）。`
        : "名前を入力して「描画を開始」を押すか、一覧から「再描画」を選んでください。";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">コース管理</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          巡行ルートをマップ上にクリックして作成・編集します（{visibleCount}/{routes.length}{" "}
          件表示中）。
        </p>
      </div>

      <AdminCard title="コース一覧">
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">名前</label>
            <Input
              placeholder="コース名"
              value={newRouteName}
              onChange={(e) => setNewRouteName(e.target.value)}
            />
          </div>
          <Button
            variant={drawMode === "new" ? "primary" : "secondary"}
            onClick={drawMode === "new" ? cancelDrawing : startNewDrawing}
          >
            {drawMode === "new" ? "描画をキャンセル" : "描画を開始"}
          </Button>
          {drawMode === "new" && (
            <>
              <Button
                variant="secondary"
                className="!px-2.5 !py-1.5 !text-xs"
                onClick={undoLastPoint}
                disabled={drawingPoints.length === 0}
              >
                1点戻す
              </Button>
              <Button
                variant="primary"
                className="!px-2.5 !py-1.5 !text-xs"
                onClick={saveNewRoute}
                disabled={drawingPoints.length < 2}
              >
                保存
              </Button>
            </>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                <th className="pb-2 pr-2 font-medium">名前</th>
                <th className="w-36 pb-2 pr-2 font-medium">状態</th>
                <th className="min-w-[20rem] pb-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {groupedRoutes.map((group) => (
                <Fragment key={group.key}>
                  <tr className="bg-slate-50">
                    <td colSpan={3} className="py-2 pr-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <span
                          className="inline-block size-2.5 shrink-0 rounded-sm"
                          style={{ background: group.color }}
                          aria-hidden
                        />
                        <span>{group.label}</span>
                        <span className="font-medium text-slate-400">{group.routes.length} 件</span>
                      </div>
                    </td>
                  </tr>
                  {group.routes.map((route) => {
                    const pointCount = coordsFromRoute(route).length;
                    const nameDirty = isRouteNameDirty(route, draftNames);
                    const isEditingThis = drawMode === "edit" && editingRouteId === route.id;

                    return (
                      <tr
                        key={route.id}
                        className={`border-b border-slate-100 align-middle ${
                          isEditingThis ? "bg-indigo-50" : ""
                        }`}
                      >
                        <td className="py-2 pr-2">
                          <Input
                            value={draftNames[route.id] ?? route.name}
                            onChange={(e) =>
                              setDraftNames((prev) => ({ ...prev, [route.id]: e.target.value }))
                            }
                          />
                        </td>
                        <td className="whitespace-nowrap py-2 pr-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge color={route.is_visible ? "#16a34a" : "#64748b"}>
                              {route.is_visible ? "表示中" : "非表示"}
                            </Badge>
                            <span className="text-xs text-slate-500">{pointCount} 点</span>
                            {isEditingThis && (
                              <span className="text-xs font-medium text-indigo-700">
                                描画中 {drawingPoints.length} 点
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap py-2">
                          <div className="flex flex-nowrap items-center gap-1">
                            <Button
                              variant="secondary"
                              className="!px-2.5 !py-1.5 !text-xs"
                              onClick={() => saveRouteName(route.id)}
                              disabled={!nameDirty}
                            >
                              保存
                            </Button>
                            <Button
                              variant="secondary"
                              className="!px-2.5 !py-1.5 !text-xs"
                              onClick={() => toggleVisibility(route)}
                            >
                              {route.is_visible ? "非表示" : "表示"}
                            </Button>
                            <Button
                              variant={isEditingThis ? "primary" : "secondary"}
                              className="!px-2.5 !py-1.5 !text-xs"
                              onClick={() =>
                                isEditingThis ? cancelDrawing() : startEditDrawing(route.id)
                              }
                            >
                              {isEditingThis ? "取消" : "再描画"}
                            </Button>
                            {isEditingThis && (
                              <>
                                <Button
                                  variant="secondary"
                                  className="!px-2.5 !py-1.5 !text-xs"
                                  onClick={undoLastPoint}
                                  disabled={drawingPoints.length === 0}
                                >
                                  1点戻す
                                </Button>
                                <Button
                                  variant="primary"
                                  className="!px-2.5 !py-1.5 !text-xs"
                                  onClick={saveEditedRoute}
                                  disabled={drawingPoints.length < 2}
                                >
                                  経路保存
                                </Button>
                              </>
                            )}
                            <Button
                              variant="danger"
                              className="!px-2.5 !py-1.5 !text-xs"
                              onClick={() => deleteRoute(route.id)}
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
          {routes.length === 0 && (
            <p className="py-4 text-sm text-slate-500">コースがまだ登録されていません。</p>
          )}
        </div>
      </AdminCard>

      <AdminCard title="コースマップ">
        <p
          className={`mb-3 flex min-h-12 items-center rounded-md px-3 py-2 text-sm ${
            drawMode !== "idle"
              ? "bg-indigo-50 font-medium text-indigo-800"
              : "bg-slate-50 text-slate-600"
          }`}
        >
          {drawingHint}
        </p>
        <div
          className={`relative h-[min(50vh,480px)] w-full overflow-hidden rounded-lg border border-slate-200 ${
            drawMode !== "idle" ? "cursor-crosshair" : ""
          }`}
        >
          <MatsuriMap
            center={mapCenter}
            zoom={event.map_zoom}
            routes={routes}
            showHiddenRoutes
            previewLines={previewLines}
            initialViewReady
            mapClickMode={drawMode !== "idle"}
            onMapClick={handleMapClick}
            className="absolute inset-0"
          />
        </div>
      </AdminCard>
    </div>
  );
}
