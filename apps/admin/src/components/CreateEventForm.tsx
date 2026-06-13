"use client";

import type { OrgSummary } from "@/lib/events";
import { createEvent } from "@/lib/events";
import { AdminCard } from "@/components/AdminCard";
import { Button, Input, Select } from "@openmatsuri/ui";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Props = {
  organizations: OrgSummary[];
};

export function CreateEventForm({ organizations }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState(organizations[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { event, error: createError } = await createEvent(supabase, { orgId, name });
    setLoading(false);

    if (createError || !event) {
      setError(createError ?? "イベントの作成に失敗しました");
      return;
    }

    router.push(`/dashboard/${event.slug}`);
    router.refresh();
  }

  return (
    <AdminCard title="新規イベント" description="管理する祭り・イベントを追加します。">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">イベント名</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 〇〇町祭り 2026"
            required
          />
        </div>
        {organizations.length > 1 && (
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">実行委員会</label>
            <Select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading || !orgId}>
          {loading ? "作成中..." : "イベントを作成"}
        </Button>
      </form>
    </AdminCard>
  );
}
