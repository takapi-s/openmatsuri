import type { OrganizationMember } from "@/lib/events";
import { ORG_ROLE_COLORS, ORG_ROLE_LABELS } from "@/lib/events";
import { Badge } from "@openmatsuri/ui";

type Props = {
  members: OrganizationMember[];
  currentUserId: string;
  currentUserEmail: string | null;
};

function formatMemberLabel(
  member: OrganizationMember,
  currentUserId: string,
  currentUserEmail: string | null,
): string {
  if (member.user_id === currentUserId) {
    return currentUserEmail ?? member.email ?? "あなた";
  }
  return member.email ?? `${member.user_id.slice(0, 8)}…`;
}

function formatJoinedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function MemberList({ members, currentUserId, currentUserEmail }: Props) {
  if (members.length === 0) {
    return <p className="text-sm text-slate-500">メンバーが登録されていません。</p>;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {members.map((member) => {
        const isSelf = member.user_id === currentUserId;
        return (
          <li
            key={member.user_id}
            className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-semibold text-slate-900">
                {formatMemberLabel(member, currentUserId, currentUserEmail)}
                {isSelf && (
                  <span className="ms-2 text-sm font-medium text-indigo-600">（あなた）</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">参加日: {formatJoinedAt(member.created_at)}</p>
            </div>
            <Badge color={ORG_ROLE_COLORS[member.role]}>{ORG_ROLE_LABELS[member.role]}</Badge>
          </li>
        );
      })}
    </ul>
  );
}
