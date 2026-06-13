import { EventHomePanel } from "@/components/EventHomePanel";
import { loadEventBySlug } from "@/lib/event-page";

type Props = { params: Promise<{ slug: string }> };

export default async function EventHomePage({ params }: Props) {
  const { slug } = await params;
  const { supabase, event } = await loadEventBySlug(slug);

  const [{ data: trackers }, { data: pois }, { data: routes }] = await Promise.all([
    supabase.from("trackers").select("*").eq("event_id", event.id),
    supabase.from("pois").select("*").eq("event_id", event.id),
    supabase.from("routes").select("*").eq("event_id", event.id),
  ]);

  return (
    <EventHomePanel
      event={event}
      initialTrackers={trackers ?? []}
      initialPois={pois ?? []}
      initialRoutes={routes ?? []}
    />
  );
}
