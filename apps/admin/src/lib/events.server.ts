import { requireUser } from "@/lib/event-page";
import { loadAccessibleEvents, loadUserOrganizations } from "@/lib/events";

export async function loadAccessibleEventsForPage() {
  const { supabase } = await requireUser();
  const [events, organizations] = await Promise.all([
    loadAccessibleEvents(supabase),
    loadUserOrganizations(supabase),
  ]);
  return { supabase, events, organizations };
}
