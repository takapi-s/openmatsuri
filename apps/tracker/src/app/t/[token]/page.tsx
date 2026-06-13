import { TrackerClient } from "@/components/TrackerClient";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ token: string }> };

async function getTrackerInfo(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const res = await fetch(`${url}/rest/v1/rpc/get_tracker_public_info`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_token: token }),
    cache: "no-store",
  });

  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] as { id: string; name: string; event_id: string } | undefined;
}

export default async function TrackerPage({ params }: Props) {
  const { token } = await params;
  const tracker = await getTrackerInfo(token);
  if (!tracker) notFound();

  return <TrackerClient token={token} trackerName={tracker.name} />;
}
