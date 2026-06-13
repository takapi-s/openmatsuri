"use client";

import { AdminCard } from "@/components/AdminCard";
import { parseCenter } from "@/lib/map";
import { MatsuriMap } from "@openmatsuri/map";
import {
  countOnlineTrackers,
  filterOnlineLocations,
  useTrackerLocations,
  useTrackerOnlineClock,
  useViewerHeatmapPoints,
  type EventRow,
  type PoiRow,
  type RouteRow,
  type TrackerRow,
} from "@openmatsuri/realtime/client";
import { Badge, Button, Textarea } from "@openmatsuri/ui";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  event: EventRow;
  initialTrackers: TrackerRow[];
  initialPois: PoiRow[];
  initialRoutes: RouteRow[];
};

const STATUS_LABELS: Record<EventRow["status"], string> = {
  draft: "非公開",
  live: "公開中",
  archived: "アーカイブ",
};

export function EventHomePanel({
  event,
  initialTrackers,
  initialPois,
  initialRoutes,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [showVisitorHeatmap, setShowVisitorHeatmap] = useState(false);
  const { locations, loading: locationsLoading, error: locationsError, lastReceivedAt } =
    useTrackerLocations(supabase, event.id);
  const onlineNow = useTrackerOnlineClock();
  const { points: heatmapPoints, loading: heatmapLoading } = useViewerHeatmapPoints(
    supabase,
    event.id,
    showVisitorHeatmap,
  );
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const prevLocationUpdatesRef = useRef<Map<string, string>>(new Map());

  const viewerUrl = `${process.env.NEXT_PUBLIC_VIEWER_URL}/e/${event.slug}`;
  const embedCode = `<iframe src="${process.env.NEXT_PUBLIC_VIEWER_URL}/embed/e/${event.slug}" width="100%" height="600" frameborder="0"></iframe>`;

  useEffect(() => {
    setMounted(true);
  }, []);

  const onlineLocations = useMemo(
    () => filterOnlineLocations(initialTrackers, locations, lastReceivedAt, onlineNow),
    [initialTrackers, locations, lastReceivedAt, onlineNow],
  );

  const onlineTrackerCount = useMemo(() => {
    if (!mounted) return 0;
    return countOnlineTrackers(initialTrackers, locations, lastReceivedAt, onlineNow);
  }, [initialTrackers, locations, lastReceivedAt, onlineNow, mounted]);

  const latestLocationAt = useMemo(() => {
    const timestamps = onlineLocations.map((location) => location.updated_at);
    if (timestamps.length === 0) return null;
    return timestamps.reduce((latest, value) => (value > latest ? value : latest));
  }, [onlineLocations]);

  useEffect(() => {
    if (locationsLoading) return;

    let message: string | null = null;
    for (const location of locations) {
      const previous = prevLocationUpdatesRef.current.get(location.tracker_id);
      if (previous && previous !== location.updated_at) {
        const tracker = initialTrackers.find((item) => item.id === location.tracker_id);
        message = `${tracker?.name ?? "トラッカー"} の位置を更新しました`;
      }
      prevLocationUpdatesRef.current.set(location.tracker_id, location.updated_at);
    }

    if (message) {
      setLiveNotice(message);
      const timer = window.setTimeout(() => setLiveNotice(null), 4000);
      return () => window.clearTimeout(timer);
    }
  }, [locations, locationsLoading, initialTrackers]);

  const toggleLive = useCallback(async () => {
    const newStatus = event.status === "live" ? "draft" : "live";
    await supabase.from("events").update({ status: newStatus }).eq("id", event.id);
    window.location.reload();
  }, [supabase, event.id, event.status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ホーム</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            ライブ監視と公開設定、共有リンクを管理します。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge color={event.status === "live" ? "#16a34a" : "#64748b"}>
            {STATUS_LABELS[event.status]}
          </Badge>
          <Button onClick={toggleLive}>
            {event.status === "live" ? "非公開にする" : "公開する"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminCard className="sm:col-span-1">
          <dl>
            <dt className="text-2xl font-bold text-slate-900">{onlineTrackerCount}</dt>
            <dd className="text-sm font-medium text-slate-500">受信中トラッカー</dd>
          </dl>
        </AdminCard>
        <AdminCard className="sm:col-span-1">
          <dl>
            <dt className="text-2xl font-bold text-slate-900">{initialTrackers.length}</dt>
            <dd className="text-sm font-medium text-slate-500">登録トラッカー数</dd>
          </dl>
        </AdminCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <AdminCard title="ライブ監視" className="overflow-hidden xl:col-span-2">
          <div className="mb-4 space-y-2 text-sm">
            {locationsLoading ? (
              <p className="text-slate-500">位置情報を読み込み中...</p>
            ) : onlineTrackerCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge color="#16a34a">{onlineTrackerCount} 台受信中</Badge>
                {mounted && latestLocationAt && (
                  <span className="text-slate-500" suppressHydrationWarning>
                    最終更新: {new Date(latestLocationAt).toLocaleTimeString("ja-JP")}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-slate-500">
                まだ位置情報がありません。トラッカー PWA から送信されるとここに表示されます。
              </p>
            )}
            {liveNotice && (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                {liveNotice}
              </p>
            )}
            {locationsError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                位置情報の取得に失敗しました: {locationsError}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant={showVisitorHeatmap ? "primary" : "secondary"}
                className="!px-3 !py-1.5 !text-xs"
                onClick={() => setShowVisitorHeatmap((value) => !value)}
              >
                {showVisitorHeatmap ? "来場者分布 ON" : "来場者分布 OFF"}
              </Button>
              {showVisitorHeatmap && (
                <span className="text-slate-500">
                  {heatmapLoading
                    ? "分布を読み込み中..."
                    : `${heatmapPoints.length} 点（直近1時間）`}
                </span>
              )}
            </div>
          </div>
          <div className="h-[28rem] overflow-hidden rounded-lg border border-slate-200">
            <MatsuriMap
              className="h-full"
              center={parseCenter(event.map_center)}
              zoom={event.map_zoom}
              trackers={initialTrackers}
              locations={onlineLocations}
              pois={initialPois}
              routes={initialRoutes}
              initialViewReady={!locationsLoading}
              showHeatmap={showVisitorHeatmap}
              heatmapPoints={heatmapPoints}
            />
          </div>
        </AdminCard>

        <AdminCard title="共有リンク">
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold text-slate-900">Viewer URL</p>
              <a
                href={viewerUrl}
                className="mt-1 block break-all font-medium text-indigo-600 hover:text-indigo-700"
                target="_blank"
                rel="noreferrer"
              >
                {viewerUrl}
              </a>
            </div>
            <div>
              <p className="font-semibold text-slate-900">埋め込みコード</p>
              <Textarea readOnly value={embedCode} rows={5} className="mt-1 font-mono text-xs" />
            </div>
            <p className="text-slate-500">
              公開中のイベントのみ来場者に表示されます。
            </p>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
