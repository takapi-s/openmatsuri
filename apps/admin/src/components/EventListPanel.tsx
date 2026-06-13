"use client";

import type { EventWithOrg, OrgSummary } from "@/lib/events";
import { AdminCard } from "@/components/AdminCard";
import { Badge } from "@openmatsuri/ui";
import Link from "next/link";
import { CreateEventForm } from "./CreateEventForm";

const STATUS_LABELS = {
  draft: "非公開",
  live: "公開中",
  archived: "アーカイブ",
} as const;

const STATUS_COLORS = {
  draft: "#64748b",
  live: "#16a34a",
  archived: "#94a3b8",
} as const;

type Props = {
  events: EventWithOrg[];
  organizations: OrgSummary[];
};

export function EventListPanel({ events, organizations }: Props) {
  const showOrgName = organizations.length > 1;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">イベント一覧</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          管理するイベントを選ぶか、新しく作成してください。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {events.length === 0 ? (
            <AdminCard>
              <p className="text-sm text-slate-500">まだイベントがありません。右のフォームから作成できます。</p>
            </AdminCard>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {events.map((event) => (
                <Link
                  key={event.id}
                  href={`/dashboard/${event.slug}`}
                  className="group rounded-lg border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600">
                      {event.name}
                    </h2>
                    <Badge color={STATUS_COLORS[event.status]}>{STATUS_LABELS[event.status]}</Badge>
                  </div>
                  {showOrgName && event.organization && (
                    <p className="mt-2 text-sm text-slate-500">{event.organization.name}</p>
                  )}
                  <p className="mt-3 text-xs text-slate-400">/{event.slug}</p>
                  {event.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{event.description}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <CreateEventForm organizations={organizations} />
        </div>
      </div>
    </div>
  );
}
