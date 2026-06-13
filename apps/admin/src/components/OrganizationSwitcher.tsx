"use client";

import type { OrgMembership } from "@/lib/events";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconPencil } from "./AdminNavIcons";

type Props = {
  organization: OrgMembership;
};

function canEditOrganization(role: OrgMembership["role"]): boolean {
  return role === "owner" || role === "editor";
}

export function OrganizationSwitcher({ organization: initialOrganization }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [organization, setOrganization] = useState(initialOrganization);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialOrganization.name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOrganization(initialOrganization);
    setName(initialOrganization.name);
  }, [initialOrganization]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const saveName = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(organization.name);
      setEditing(false);
      return;
    }
    if (trimmed === organization.name) {
      setEditing(false);
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({ name: trimmed })
      .eq("id", organization.id);
    setSaving(false);

    if (error) {
      setName(organization.name);
      setEditing(false);
      return;
    }

    setOrganization((prev) => ({ ...prev, name: trimmed }));
    setEditing(false);
    router.refresh();
  }, [supabase, organization, name, router]);

  const cancelEdit = useCallback(() => {
    setName(organization.name);
    setEditing(false);
  }, [organization.name]);

  function handleNameKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveName();
    }
    if (event.key === "Escape") {
      cancelEdit();
    }
  }

  const editable = canEditOrganization(organization.role);

  return (
    <div className="min-w-0">
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
          aria-label="実行委員会名"
        />
      ) : editable ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="group flex max-w-[12rem] items-center gap-1 rounded-md border border-transparent px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-indigo-100 hover:text-indigo-600 sm:max-w-xs"
          title="クリックして名前を編集"
          aria-label={`${organization.name} を編集`}
        >
          <span className="truncate">{organization.name}</span>
          <IconPencil className="size-3.5 shrink-0 text-slate-400 group-hover:text-indigo-500" />
        </button>
      ) : (
        <span className="max-w-[12rem] truncate px-2 py-1.5 text-sm font-semibold text-slate-700 sm:max-w-xs">
          {organization.name}
        </span>
      )}
    </div>
  );
}
