"use client";

import { toGeographyEwkt } from "@openmatsuri/config";
import { Button, Card, Input } from "@openmatsuri/ui";
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("ログインが必要です");
      setLoading(false);
      return;
    }

    // INSERT ... RETURNING は SELECT ポリシー（メンバー限定）に阻まれるため ID を先に確定する
    const orgId = crypto.randomUUID();

    const { error: orgError } = await supabase
      .from("organizations")
      .insert({ id: orgId, name: orgName });

    if (orgError) {
      setError(orgError.message);
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase.from("organization_members").insert({
      org_id: orgId,
      user_id: user.id,
      role: "owner",
    });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    const slug = `matsuri-${Date.now()}`;
    const { error: eventError } = await supabase.from("events").insert({
      org_id: orgId,
      slug,
      name: "新しい祭り",
      status: "draft",
      map_zoom: 14,
      map_center: toGeographyEwkt(135.5023, 34.6937),
    });

    if (eventError) {
      setError(eventError.message);
      setLoading(false);
      return;
    }

    router.push(`/dashboard/${slug}`);
    router.refresh();
  }

  async function joinDemoOrg() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const demoOrgId = "11111111-1111-1111-1111-111111111111";
    const { error } = await supabase.from("organization_members").insert({
      org_id: demoOrgId,
      user_id: user.id,
      role: "editor",
    });

    setLoading(false);
    if (error) setError(error.message);
    else {
      router.push("/dashboard/demo-matsuri");
      router.refresh();
    }
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
