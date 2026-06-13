"use client";

import { inviteOrgMember, ORG_ROLE_LABELS, type OrgRole } from "@/lib/events";
import { AdminCard } from "@/components/AdminCard";
import { Button, Input, Select } from "@openmatsuri/ui";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Props = {
  orgId: string;
};

const INVITE_ROLES: Exclude<OrgRole, "owner">[] = ["editor", "viewer"];

export function InviteMemberForm({ orgId }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<OrgRole, "owner">>("editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { error: inviteError } = await inviteOrgMember(supabase, { orgId, email, role });
    setLoading(false);

    if (inviteError) {
      setError(inviteError);
      return;
    }

    setEmail("");
    setSuccess(`${email.trim()} を招待しました。`);
    router.refresh();
  }

  return (
    <AdminCard title="メンバーを招待" description="Admin に登録済みのメールアドレスを指定してください。">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">メールアドレス</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@example.com"
            required
            disabled={loading}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">権限</label>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as Exclude<OrgRole, "owner">)}
            disabled={loading}
          >
            {INVITE_ROLES.map((inviteRole) => (
              <option key={inviteRole} value={inviteRole}>
                {ORG_ROLE_LABELS[inviteRole]}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
        <Button type="submit" disabled={loading || !email.trim()}>
          {loading ? "招待中..." : "招待する"}
        </Button>
      </form>
    </AdminCard>
  );
}
