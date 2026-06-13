import { requireUser } from "@/lib/event-page";
import {
  loadAccessibleEvents,
  loadOrganizationMembers,
  loadUserOrganizations,
  type OrgWithMembers,
} from "@/lib/events";

export async function loadOrganizationMembersForPage() {
  const { supabase, user } = await requireUser();
  const organizations = await loadUserOrganizations(supabase);

  const organizationMembers: OrgWithMembers[] = await Promise.all(
    organizations.map(async (org) => ({
      ...org,
      members: await loadOrganizationMembers(supabase, org.id),
    })),
  );

  return { user, organizations, organizationMembers };
}

export async function loadAccessibleEventsForPage() {
  const { supabase, user } = await requireUser();
  const [events, organizations] = await Promise.all([
    loadAccessibleEvents(supabase),
    loadUserOrganizations(supabase),
  ]);

  return { supabase, user, events, organizations };
}
