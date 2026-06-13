import type { EventRow } from "@openmatsuri/realtime";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return { supabase, user };
}

export async function loadEventBySlug(slug: string) {
  const { supabase } = await requireUser();

  const { data: eventData } = await supabase.from("events").select("*").eq("slug", slug).single();
  const event = eventData as EventRow | null;
  if (!event) notFound();

  return { supabase, event };
}
