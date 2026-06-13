import { DashboardShell } from "@/components/DashboardShell";
import { OrganizationMembersPanel } from "@/components/OrganizationMembersPanel";
import { loadOrganizationMembersForPage } from "@/lib/events.server";
import { redirect } from "next/navigation";

export default async function DashboardMembersPage() {
  const { user, organizations, organizationMembers } = await loadOrganizationMembersForPage();

  if (!organizations.length) redirect("/dashboard");

  return (
    <DashboardShell organization={organizations[0]}>
      <OrganizationMembersPanel
        organizationMembers={organizationMembers}
        currentUserId={user.id}
        currentUserEmail={user.email ?? null}
      />
    </DashboardShell>
  );
}
