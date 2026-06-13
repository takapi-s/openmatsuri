"use client";

import type { EventWithOrg } from "@/lib/events";
import { loadAccessibleEvents } from "@/lib/events";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconChevronDown, IconPencil } from "./AdminNavIcons";

type Props = {
  eventId: string;
  currentSlug: string;
  currentName: string;
};

export function EventSwitcher({ eventId, currentSlug, currentName }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<EventWithOrg[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  useEffect(() => {
    void loadAccessibleEvents(supabase).then(setEvents);
  }, [supabase, currentSlug, currentName]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const saveName = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(currentName);
      setEditing(false);
      return;
    }
    if (trimmed === currentName) {
      setEditing(false);
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("events").update({ name: trimmed }).eq("id", eventId);
    setSaving(false);

    if (error) {
      setName(currentName);
      setEditing(false);
      return;
    }

    setEditing(false);
    router.refresh();
  }, [supabase, eventId, currentName, name, router]);

  const cancelEdit = useCallback(() => {
    setName(currentName);
    setEditing(false);
  }, [currentName]);

  function handleNameKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveName();
    }
    if (event.key === "Escape") {
      cancelEdit();
    }
  }

  return (
    <div className="relative min-w-0" ref={ref}>
      <div className="flex min-w-0 items-center">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={name}
            disabled={saving}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleNameKeyDown}
            onBlur={() => void saveName()}
            className="max-w-[10rem] rounded-md border border-indigo-300 bg-white px-2 py-1.5 text-sm font-semibold text-slate-900 outline-none ring-2 ring-indigo-100 sm:max-w-xs"
            aria-label="イベント名"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="group flex max-w-[12rem] items-center gap-1 rounded-md border border-transparent px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-indigo-100 hover:text-indigo-600 sm:max-w-xs"
            title="クリックして名前を編集"
            aria-label={`${currentName} を編集`}
          >
            <span className="truncate">{currentName}</span>
            <IconPencil className="size-3.5 shrink-0 text-slate-400 group-hover:text-indigo-500" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="shrink-0 rounded-md border border-transparent p-1.5 text-slate-700 hover:bg-indigo-100 hover:text-indigo-600"
          aria-label="イベントを切り替え"
          aria-expanded={open}
        >
          <IconChevronDown className="size-4 text-slate-400" />
        </button>
      </div>

      {open && (
        <div className="absolute start-0 z-30 mt-2 w-72 rounded-sm shadow-xl shadow-slate-200">
          <div className="max-h-80 overflow-y-auto rounded-sm bg-white py-2 ring-1 ring-slate-900/5">
            <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              イベントを切り替え
            </p>
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/dashboard/${event.slug}`}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 text-sm hover:bg-slate-50 ${
                  event.slug === currentSlug
                    ? "bg-indigo-50 font-semibold text-indigo-700"
                    : "text-slate-900"
                }`}
              >
                <span className="block truncate">{event.name}</span>
                {event.organization && events.some((e) => e.org_id !== event.org_id) && (
                  <span className="block truncate text-xs text-slate-500">
                    {event.organization.name}
                  </span>
                )}
              </Link>
            ))}
            <hr className="my-2 border-slate-100" />
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-slate-50"
            >
              すべてのイベントを見る
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
