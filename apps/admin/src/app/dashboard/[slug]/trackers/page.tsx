import { TrackerManagement } from "@/components/TrackerManagement";
import { loadEventBySlug } from "@/lib/event-page";

type Props = { params: Promise<{ slug: string }> };

export default async function TrackersPage({ params }: Props) {
  const { slug } = await params;
  const { supabase, event } = await loadEventBySlug(slug);

  const { data: trackers } = await supabase
    .from("trackers")
    .select("*")
    .eq("event_id", event.id);

  return <TrackerManagement event={event} initialTrackers={trackers ?? []} />;
}
