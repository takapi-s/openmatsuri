import { AdminCard } from "@/components/AdminCard";
import { InviteMemberForm } from "@/components/InviteMemberForm";
import { MemberList } from "@/components/MemberList";
import type { OrgWithMembers } from "@/lib/events";

type Props = {
  organizationMembers: OrgWithMembers[];
  currentUserId: string;
  currentUserEmail: string | null;
};

export function OrganizationMembersPanel({
  organizationMembers,
  currentUserId,
  currentUserEmail,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">参加者一覧</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          実行委員会に所属する運営者を確認・招待できます。
        </p>
      </div>

      {organizationMembers.map((org) => (
        <div key={org.id} className="space-y-4">
          {organizationMembers.length > 1 && (
            <h2 className="text-lg font-bold text-slate-900">{org.name}</h2>
          )}
          {org.role === "owner" && <InviteMemberForm orgId={org.id} />}
          <AdminCard title="メンバー" description="同じ実行委員会に所属する運営者の一覧です。">
            <MemberList
              members={org.members}
              currentUserId={currentUserId}
              currentUserEmail={currentUserEmail}
            />
          </AdminCard>
        </div>
      ))}
    </div>
  );
}
