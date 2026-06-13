"use client";

import { DEVICE_TYPE_LABELS, type DeviceType } from "@openmatsuri/config";
import {
  isTrackerOnline,
  isTrackerStale,
  useTrackerLocations,
  type EventRow,
  type TrackerRow,
} from "@openmatsuri/realtime/client";
import { AdminCard } from "@/components/AdminCard";
import { Badge, Button, Input, Select } from "@openmatsuri/ui";
import { createClient } from "@/lib/supabase/client";
import QRCode from "qrcode";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  event: EventRow;
  initialTrackers: TrackerRow[];
};

const DEVICE_TYPE_ORDER = Object.keys(DEVICE_TYPE_LABELS) as DeviceType[];

const DEVICE_TYPE_COLORS: Record<DeviceType, string> = {
  pwa: "#4f46e5",
  soracom_lte: "#0891b2",
  android_agent: "#16a34a",
  pi_agent: "#d97706",
  external: "#64748b",
};

function trackerUrl(tracker: TrackerRow): string {
  return `${process.env.NEXT_PUBLIC_TRACKER_URL}/t/${tracker.secret_token}`;
}

function isTrackerDirty(
  tracker: TrackerRow,
  draftNames: Record<string, string>,
  draftDeviceTypes: Record<string, DeviceType>,
): boolean {
  const name = draftNames[tracker.id] ?? tracker.name;
  const deviceType = draftDeviceTypes[tracker.id] ?? tracker.device_type;
  return name !== tracker.name || deviceType !== tracker.device_type;
}

export function TrackerManagement({ event, initialTrackers }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { locations, lastReceivedAt } = useTrackerLocations(supabase, event.id);
  const [trackers, setTrackers] = useState(initialTrackers);
  const [newTrackerName, setNewTrackerName] = useState("");
  const [expandedQrId, setExpandedQrId] = useState<string | null>(null);
  const [qrCache, setQrCache] = useState<Record<string, string>>({});
  const [trackerError, setTrackerError] = useState<string | null>(null);
  const [draftNames, setDraftNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialTrackers.map((t) => [t.id, t.name])),
  );
  const [draftDeviceTypes, setDraftDeviceTypes] = useState<Record<string, DeviceType>>(() =>
    Object.fromEntries(initialTrackers.map((t) => [t.id, t.device_type])),
  );
  const [mounted, setMounted] = useState(false);
  const [, setStatusTick] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setStatusTick((tick) => tick + 1), 10_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setDraftNames((prev) => {
      const next = { ...prev };
      for (const tracker of trackers) {
        if (!(tracker.id in next)) next[tracker.id] = tracker.name;
      }
      return next;
    });
    setDraftDeviceTypes((prev) => {
      const next = { ...prev };
      for (const tracker of trackers) {
        if (!(tracker.id in next)) next[tracker.id] = tracker.device_type;
      }
      return next;
    });
  }, [trackers]);

  useEffect(() => {
    const fetchTrackers = async () => {
      const { data } = await supabase.from("trackers").select("*").eq("event_id", event.id);
      if (data) setTrackers(data);
    };

    const poll = window.setInterval(() => {
      void fetchTrackers();
    }, 8_000);

    const channel = supabase
      .channel(`trackers:${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trackers",
          filter: `event_id=eq.${event.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as TrackerRow;
            setTrackers((prev) => prev.filter((tracker) => tracker.id !== deleted.id));
            return;
          }

          const row = payload.new as TrackerRow;
          setTrackers((prev) => {
            const index = prev.findIndex((tracker) => tracker.id === row.id);
            if (index >= 0) {
              const next = [...prev];
              next[index] = row;
              return next;
            }
            return [...prev, row];
          });
          setDraftNames((prev) => ({ ...prev, [row.id]: row.name }));
          setDraftDeviceTypes((prev) => ({ ...prev, [row.id]: row.device_type }));
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [supabase, event.id]);

  const locationByTracker = useMemo(
    () => new Map(locations.map((location) => [location.tracker_id, location])),
    [locations],
  );

  const deviceTypeSelectOptions = Object.entries(DEVICE_TYPE_LABELS).map(([k, v]) => (
    <option key={k} value={k}>
      {v}
    </option>
  ));

  const groupedTrackers = useMemo(() => {
    const groups = new Map<DeviceType, TrackerRow[]>();
    for (const deviceType of DEVICE_TYPE_ORDER) {
      groups.set(deviceType, []);
    }
    for (const tracker of trackers) {
      const deviceType = draftDeviceTypes[tracker.id] ?? tracker.device_type;
      groups.get(deviceType)?.push(tracker);
    }
    return DEVICE_TYPE_ORDER.map((deviceType) => ({
      deviceType,
      trackers: groups.get(deviceType) ?? [],
    })).filter((group) => group.trackers.length > 0);
  }, [trackers, draftDeviceTypes]);

  const toggleQr = useCallback(async (tracker: TrackerRow) => {
    if (expandedQrId === tracker.id) {
      setExpandedQrId(null);
      return;
    }

    setExpandedQrId(tracker.id);
    if (qrCache[tracker.id]) return;

    const dataUrl = await QRCode.toDataURL(trackerUrl(tracker), { width: 200 });
    setQrCache((prev) => ({ ...prev, [tracker.id]: dataUrl }));
  }, [expandedQrId, qrCache]);

  const addTracker = useCallback(async () => {
    if (!newTrackerName.trim()) return;
    setTrackerError(null);

    const trackerId = crypto.randomUUID();
    const secretToken = crypto.randomUUID();
    const name = newTrackerName.trim();

    const { error } = await supabase.from("trackers").insert({
      id: trackerId,
      secret_token: secretToken,
      event_id: event.id,
      name,
      device_type: "pwa",
    });

    if (error) {
      setTrackerError(error.message);
      return;
    }

    const created: TrackerRow = {
      id: trackerId,
      secret_token: secretToken,
      event_id: event.id,
      name,
      device_type: "pwa",
      description: null,
      group_name: null,
      icon_url: null,
      icon_color: "#e11d48",
      soracom_sim_id: null,
      external_device_id: null,
      is_active: true,
      last_seen_at: null,
      created_at: new Date().toISOString(),
    };

    setTrackers((prev) => [...prev, created]);
    setDraftNames((prev) => ({ ...prev, [trackerId]: name }));
    setDraftDeviceTypes((prev) => ({ ...prev, [trackerId]: "pwa" }));
    setNewTrackerName("");
  }, [supabase, event.id, newTrackerName]);

  const saveTracker = useCallback(
    async (trackerId: string) => {
      setTrackerError(null);
      const name = draftNames[trackerId]?.trim();
      const deviceType = draftDeviceTypes[trackerId];
      if (!name) {
        setTrackerError("トラッカー名を入力してください");
        return;
      }

      const { error } = await supabase
        .from("trackers")
        .update({ name, device_type: deviceType })
        .eq("id", trackerId);

      if (error) {
        setTrackerError(error.message);
        return;
      }

      setTrackers((prev) =>
        prev.map((tracker) =>
          tracker.id === trackerId ? { ...tracker, name, device_type: deviceType } : tracker,
        ),
      );
    },
    [supabase, draftNames, draftDeviceTypes],
  );

  const deleteTracker = useCallback(
    async (trackerId: string) => {
      if (!window.confirm("このトラッカーを削除しますか？")) return;
      setTrackerError(null);

      const { error } = await supabase.from("trackers").delete().eq("id", trackerId);
      if (error) {
        setTrackerError(error.message);
        return;
      }

      setTrackers((prev) => prev.filter((tracker) => tracker.id !== trackerId));
      setDraftNames((prev) => {
        const next = { ...prev };
        delete next[trackerId];
        return next;
      });
      setDraftDeviceTypes((prev) => {
        const next = { ...prev };
        delete next[trackerId];
        return next;
      });
      if (expandedQrId === trackerId) setExpandedQrId(null);
      setQrCache((prev) => {
        const next = { ...prev };
        delete next[trackerId];
        return next;
      });
    },
    [supabase, expandedQrId],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">トラッカー管理</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          位置を送信する端末（PWA など）を登録し、QR コードで配布します。
        </p>
      </div>

      <AdminCard title="トラッカー一覧">
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">名前</label>
            <Input
              placeholder="トラッカー名"
              value={newTrackerName}
              onChange={(e) => setNewTrackerName(e.target.value)}
            />
          </div>
          <Button onClick={addTracker}>追加</Button>
        </div>

        {trackerError && <p className="mb-3 text-sm text-red-600">{trackerError}</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                <th className="w-40 pb-2 pr-2 font-medium">名前</th>
                <th className="w-28 pb-2 pr-2 font-medium">状態</th>
                <th className="pb-2 pr-2 font-medium">Tracker URL</th>
                <th className="min-w-[18rem] pb-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {groupedTrackers.map((group) => (
                <Fragment key={group.deviceType}>
                  <tr className="bg-slate-50">
                    <td colSpan={4} className="py-2 pr-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <span
                          className="inline-block size-2.5 shrink-0 rounded-sm"
                          style={{ background: DEVICE_TYPE_COLORS[group.deviceType] }}
                          aria-hidden
                        />
                        <span>{DEVICE_TYPE_LABELS[group.deviceType]}</span>
                        <span className="font-medium text-slate-400">
                          {group.trackers.length} 件
                        </span>
                      </div>
                    </td>
                  </tr>
                  {group.trackers.map((tracker) => {
                    const loc = locationByTracker.get(tracker.id);
                    const receivedAt = lastReceivedAt[tracker.id];
                    const online = mounted && isTrackerOnline(tracker, loc, receivedAt);
                    const stale = mounted && isTrackerStale(tracker, loc, receivedAt);
                    const dirty = isTrackerDirty(tracker, draftNames, draftDeviceTypes);
                    const url = trackerUrl(tracker);
                    const qrOpen = expandedQrId === tracker.id;

                    return (
                      <Fragment key={tracker.id}>
                        <tr className="border-b border-slate-100 align-middle">
                          <td className="py-2 pr-2">
                            <Input
                              value={draftNames[tracker.id] ?? tracker.name}
                              onChange={(e) =>
                                setDraftNames((prev) => ({
                                  ...prev,
                                  [tracker.id]: e.target.value,
                                }))
                              }
                            />
                          </td>
                          <td className="whitespace-nowrap py-2 pr-2">
                            <div className="space-y-1">
                              {online ? (
                                <Badge color="#16a34a">受信中</Badge>
                              ) : stale ? (
                                <Badge color="#dc2626">通信断</Badge>
                              ) : (
                                <Badge color="#64748b">未接続</Badge>
                              )}
                              {tracker.soracom_sim_id && (
                                <p className="text-[10px] text-slate-500">
                                  SIM: {tracker.soracom_sim_id}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-2 pr-2">
                            <Input
                              readOnly
                              value={url}
                              className="!text-xs"
                              onFocus={(e) => e.currentTarget.select()}
                            />
                          </td>
                          <td className="whitespace-nowrap py-2">
                            <div className="flex flex-nowrap items-center gap-1">
                              <Select
                                value={draftDeviceTypes[tracker.id] ?? tracker.device_type}
                                onChange={(e) =>
                                  setDraftDeviceTypes((prev) => ({
                                    ...prev,
                                    [tracker.id]: e.target.value as DeviceType,
                                  }))
                                }
                                title="端末種別を変更"
                                style={{ width: "7.5rem", minWidth: "7.5rem" }}
                              >
                                {deviceTypeSelectOptions}
                              </Select>
                              <Button
                                variant="secondary"
                                className="!px-2.5 !py-1.5 !text-xs"
                                onClick={() => saveTracker(tracker.id)}
                                disabled={!dirty}
                              >
                                保存
                              </Button>
                              <Button
                                variant={qrOpen ? "primary" : "secondary"}
                                className="!px-2.5 !py-1.5 !text-xs"
                                onClick={() => toggleQr(tracker)}
                                aria-expanded={qrOpen}
                              >
                                QR {qrOpen ? "▲" : "▼"}
                              </Button>
                              <Button
                                variant="danger"
                                className="!px-2.5 !py-1.5 !text-xs"
                                onClick={() => deleteTracker(tracker.id)}
                              >
                                削除
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {qrOpen && (
                          <tr className="border-b border-slate-100 bg-slate-50">
                            <td colSpan={4} className="py-3 text-center">
                              {qrCache[tracker.id] ? (
                                <img
                                  src={qrCache[tracker.id]}
                                  alt={`${tracker.name} の QR コード`}
                                  className="mx-auto"
                                />
                              ) : (
                                <p className="text-xs text-slate-500">QR を生成中...</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
          {trackers.length === 0 && (
            <p className="py-4 text-sm text-slate-500">トラッカーがまだ登録されていません。</p>
          )}
        </div>
      </AdminCard>
    </div>
  );
}
