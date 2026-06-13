import { toGeographyEwkt } from "@openmatsuri/config";
import type { EventRow } from "@openmatsuri/realtime";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgSummary = { id: string; name: string };

export type EventWithOrg = EventRow & {
  organization?: OrgSummary | null;
};

export async function loadUserOrganizations(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("org_id, organizations(id, name)")
    .eq("user_id", user.id);

  if (!memberships?.length) return [];

  return memberships
    .map((row) => {
      const raw = row.organizations as OrgSummary | OrgSummary[] | null;
      const org = Array.isArray(raw) ? raw[0] : raw;
      return org ? { id: org.id, name: org.name } : null;
    })
    .filter((org): org is OrgSummary => org != null);
}

export async function loadAccessibleEvents(supabase: SupabaseClient): Promise<EventWithOrg[]> {
  const orgs = await loadUserOrganizations(supabase);
  if (!orgs.length) return [];

  const orgIds = orgs.map((org) => org.id);
  const orgById = new Map(orgs.map((org) => [org.id, org]));

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .in("org_id", orgIds)
    .order("created_at", { ascending: false });

  return (events ?? []).map((event) => ({
    ...(event as EventRow),
    organization: orgById.get(event.org_id) ?? null,
  }));
}

export function buildEventSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Date.now().toString(36);
  return base ? `${base}-${suffix}` : `matsuri-${suffix}`;
}

export async function createEvent(
  supabase: SupabaseClient,
  input: { orgId: string; name: string },
): Promise<{ event: EventRow | null; error: string | null }> {
  const name = input.name.trim();
  if (!name) return { event: null, error: "イベント名を入力してください" };

  const slug = buildEventSlug(name);
  const { error } = await supabase.from("events").insert({
    org_id: input.orgId,
    slug,
    name,
    status: "draft",
    map_zoom: 14,
    viewer_location_retention_days: 365,
    map_center: toGeographyEwkt(135.5023, 34.6937),
  });

  if (error) return { event: null, error: error.message };
  return {
    event: {
      id: "",
      org_id: input.orgId,
      slug,
      name,
      description: null,
      starts_at: null,
      ends_at: null,
      status: "draft",
      map_center: null,
      map_zoom: 14,
      viewer_location_retention_days: 365,
      created_at: new Date().toISOString(),
    },
    error: null,
  };
}
