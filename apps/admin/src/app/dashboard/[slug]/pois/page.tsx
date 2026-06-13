import { PoiManagement } from "@/components/PoiManagement";
import { loadEventBySlug } from "@/lib/event-page";

type Props = { params: Promise<{ slug: string }> };

export default async function PoisPage({ params }: Props) {
  const { slug } = await params;
  const { supabase, event } = await loadEventBySlug(slug);

  const { data: pois } = await supabase.from("pois").select("*").eq("event_id", event.id);

  return <PoiManagement event={event} initialPois={pois ?? []} />;
}
