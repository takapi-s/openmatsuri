import { RouteManagement } from "@/components/RouteManagement";
import { loadEventBySlug } from "@/lib/event-page";

type Props = { params: Promise<{ slug: string }> };

export default async function RoutesPage({ params }: Props) {
  const { slug } = await params;
  const { supabase, event } = await loadEventBySlug(slug);

  const { data: routes } = await supabase.from("routes").select("*").eq("event_id", event.id);

  return <RouteManagement event={event} initialRoutes={routes ?? []} />;
}
