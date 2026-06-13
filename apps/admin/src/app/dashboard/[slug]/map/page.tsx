import { MapSettings } from "@/components/MapSettings";
import { loadEventBySlug } from "@/lib/event-page";

type Props = { params: Promise<{ slug: string }> };

export default async function MapSettingsPage({ params }: Props) {
  const { slug } = await params;
  const { event } = await loadEventBySlug(slug);

  return <MapSettings event={event} />;
}
