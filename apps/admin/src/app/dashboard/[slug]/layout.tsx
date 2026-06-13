import { AdminShell } from "@/components/AdminShell";
import { loadEventBySlug } from "@/lib/event-page";

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export default async function EventDashboardLayout({ children, params }: Props) {
  const { slug } = await params;
  const { event } = await loadEventBySlug(slug);

  return (
    <AdminShell slug={slug} eventId={event.id} eventName={event.name}>
      {children}
    </AdminShell>
  );
}
