import { EventMapView } from "@/components/EventMapView";
import { getSupabase } from "@/lib/supabase";
import type { EventRow } from "@openmatsuri/realtime";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export default async function EmbedEventPage({ params }: Props) {
  const { slug } = await params;
  const supabase = getSupabase();

  const { data: eventData } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .single();

  const event = eventData as EventRow | null;
  if (!event) notFound();

  const [{ data: trackers }, { data: pois }, { data: routes }] = await Promise.all([
    supabase.from("trackers").select("*").eq("event_id", event.id),
    supabase.from("pois").select("*").eq("event_id", event.id),
    supabase.from("routes").select("*").eq("event_id", event.id),
  ]);

  return (
    <EventMapView
      event={event}
      trackers={trackers ?? []}
      pois={pois ?? []}
      routes={routes ?? []}
      embed
    />
  );
}
