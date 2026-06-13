"use client";

import { Button, Card, Input } from "@openmatsuri/ui";
import {
  createOrganizationWithEvent,
  DEMO_ORG_ID,
  joinOrganization,
} from "@/lib/events";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SetupOrganization() {
  const [orgName, setOrgName] = useState("私の実行委員会");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSetup() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { slug, error: setupError } = await createOrganizationWithEvent(supabase, orgName);
    setLoading(false);

    if (setupError || !slug) {
      setError(setupError ?? "実行委員会の作成に失敗しました");
      return;
    }

    router.push(`/dashboard/${slug}`);
    router.refresh();
  }

  async function joinDemoOrg() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: joinError } = await joinOrganization(supabase, DEMO_ORG_ID);
    setLoading(false);

    if (joinError) {
      setError(joinError);
      return;
    }

    router.push("/dashboard/demo-matsuri");
    router.refresh();
  }

  return (
    <Card title="初回セットアップ">
      <p className="mb-4 text-sm text-slate-600">
        組織を作成するか、デモ実行委員会に参加してください。
      </p>
      <Input
        value={orgName}
        onChange={(e) => setOrgName(e.target.value)}
        placeholder="組織名"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex flex-col gap-2">
        <Button disabled={loading} onClick={handleSetup} block>
          新規組織を作成
        </Button>
        <Button variant="secondary" disabled={loading} onClick={joinDemoOrg} block>
          デモ実行委員会に参加
        </Button>
      </div>
    </Card>
  );
}
