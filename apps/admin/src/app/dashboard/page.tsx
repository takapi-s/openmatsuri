import { DashboardShell } from "@/components/DashboardShell";
import { EventListPanel } from "@/components/EventListPanel";
import { SetupOrganization } from "@/components/SetupOrganization";
import { loadAccessibleEventsForPage } from "@/lib/events.server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1);

  if (!membership?.length) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-8">
        <div className="w-full max-w-md">
          <SetupOrganization />
        </div>
      </main>
    );
  }

  const { events, organizations } = await loadAccessibleEventsForPage();

  return (
    <DashboardShell organization={organizations[0]}>
      <EventListPanel events={events} organizations={organizations} />
    </DashboardShell>
  );
}
