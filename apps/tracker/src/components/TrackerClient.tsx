"use client";

import { MatsuriMap } from "@openmatsuri/map";
import { postLocation } from "@openmatsuri/tracker-ingest";
import { AppShell, Badge, Button, PanelCard } from "@openmatsuri/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { enqueueLocation, flushQueue, getQueueSize } from "@/lib/offline-queue";

type Props = {
  token: string;
  trackerName: string;
};

type Status = "idle" | "sending" | "stopped" | "error";

type CurrentPosition = {
  lat: number;
  lng: number;
  heading?: number;
  accuracy?: number;
};

const STATUS_LABELS: Record<Status, string> = {
  idle: "待機中",
  sending: "送信中",
  stopped: "停止中",
  error: "エラー",
};

const STATUS_COLORS: Record<Status, string> = {
  idle: "#64748b",
  sending: "#16a34a",
  stopped: "#94a3b8",
  error: "#dc2626",
};

export function TrackerClient({ token, trackerName }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queueSize, setQueueSize] = useState(0);
  const [currentPosition, setCurrentPosition] = useState<CurrentPosition | null>(null);
  const [locating, setLocating] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const sendOne = useCallback(
    async (lat: number, lng: number, heading?: number, accuracy?: number) => {
      const result = await postLocation({
        endpoint,
        anonKey,
        token,
        lat,
        lng,
        heading,
        accuracy,
        source: "pwa",
      });

      if (!result.ok) {
        setError(result.error ?? "位置の送信に失敗しました");
        await enqueueLocation({
          token,
          lat,
          lng,
          heading,
          accuracy,
          recordedAt: new Date().toISOString(),
        });
        setQueueSize(await getQueueSize());
        return false;
      }

      setError(null);
      setLastSent(new Date().toLocaleTimeString("ja-JP"));
      return true;
    },
    [endpoint, anonKey, token],
  );

  const flush = useCallback(async () => {
    const sent = await flushQueue(async (item) => {
      const result = await postLocation({
        endpoint,
        anonKey,
        token: item.token,
        lat: item.lat,
        lng: item.lng,
        heading: item.heading,
        accuracy: item.accuracy,
        recordedAt: item.recordedAt,
        source: "pwa",
      });
      return result.ok;
    });
    if (sent > 0) setQueueSize(await getQueueSize());
  }, [endpoint, anonKey, token]);

  const handlePosition = useCallback(
    (pos: GeolocationPosition) => {
      setLocating(false);
      const { latitude, longitude, heading, accuracy } = pos.coords;
      setCurrentPosition({
        lat: latitude,
        lng: longitude,
        heading: heading ?? undefined,
        accuracy,
      });

      if (!activeRef.current) return;

      void sendOne(latitude, longitude, heading ?? undefined, accuracy);
    },
    [sendOne],
  );

  const ensureWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setError("この端末は位置情報に対応していません");
      setStatus("error");
      setLocating(false);
      return;
    }

    if (watchIdRef.current != null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      (err) => {
        setLocating(false);
        setError(err.message);
        setStatus("error");
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
  }, [handlePosition]);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError("この端末は位置情報に対応していません");
      setStatus("error");
      return;
    }

    if (!endpoint || !anonKey) {
      setError("Supabase の接続設定がありません（.env.local を確認）");
      setStatus("error");
      return;
    }

    activeRef.current = true;
    setStatus("sending");
    setError(null);
    ensureWatch();
    void flush();

    if (currentPosition) {
      void sendOne(
        currentPosition.lat,
        currentPosition.lng,
        currentPosition.heading,
        currentPosition.accuracy,
      );
    }
  }, [ensureWatch, flush, sendOne, endpoint, anonKey, currentPosition]);

  const stop = useCallback(() => {
    activeRef.current = false;
    setStatus("stopped");
  }, []);

  useEffect(() => {
    getQueueSize().then(setQueueSize);
    ensureWatch();

    return () => {
      activeRef.current = false;
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [ensureWatch]);

  return (
    <AppShell appLabel="Tracker" title={trackerName} description="位置情報を祭りマップへ送信" compact>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <PanelCard title="現在地" className="overflow-hidden p-0">
          <div className="relative h-56 overflow-hidden">
            {currentPosition ? (
              <MatsuriMap
                className="h-full"
                zoom={16}
                followTrackersCenter={false}
                initialViewReady
                userPosition={currentPosition}
                centerOnUserPosition
                markerAnimationMs={1200}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-sm text-slate-600">
                <p className="font-medium">
                  {locating ? "現在地を取得しています…" : "位置情報を取得できません"}
                </p>
                {!locating && (
                  <Button size="md" variant="secondary" onClick={ensureWatch}>
                    再試行
                  </Button>
                )}
              </div>
            )}
            <div className="pointer-events-none absolute left-3 top-3">
              <Badge color="#4f46e5">現在地</Badge>
            </div>
          </div>
          {currentPosition && (
            <p className="border-t border-slate-100 px-4 py-3 text-center text-xs font-medium text-slate-500">
              {currentPosition.lat.toFixed(5)}, {currentPosition.lng.toFixed(5)}
              {currentPosition.accuracy != null && `（精度 ±${Math.round(currentPosition.accuracy)}m）`}
            </p>
          )}
        </PanelCard>

        <PanelCard title="送信ステータス">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-2xl font-bold text-slate-900">{STATUS_LABELS[status]}</p>
              {lastSent && (
                <p className="mt-1 text-sm font-medium text-slate-500" suppressHydrationWarning>
                  最終送信: {lastSent}
                </p>
              )}
            </div>
            <Badge color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
          </div>
          {queueSize > 0 && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              オフラインキュー: {queueSize} 件
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </PanelCard>

        <div className="flex flex-col gap-3">
          {status !== "sending" ? (
            <Button size="lg" block onClick={start} disabled={!currentPosition}>
              送信開始
            </Button>
          ) : (
            <Button size="lg" variant="danger" block onClick={stop}>
              送信停止
            </Button>
          )}
        </div>

        <PanelCard>
          <p className="text-sm text-slate-600">
            <strong className="font-semibold text-slate-900">注意:</strong>{" "}
            画面をオフにすると iOS では位置送信が止まる場合があります。本番運用では SORACOM LTE
            GPS または Android Agent の利用を推奨します。
          </p>
        </PanelCard>
      </div>
    </AppShell>
  );
}
