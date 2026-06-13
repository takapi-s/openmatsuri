import { toGeographyEwkt } from "@openmatsuri/config";
import type { EventRow } from "@openmatsuri/realtime";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgRole = "owner" | "editor" | "viewer";

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "オーナー",
  editor: "編集者",
  viewer: "閲覧者",
};

export const ORG_ROLE_COLORS: Record<OrgRole, string> = {
  owner: "#4f46e5",
  editor: "#0891b2",
  viewer: "#64748b",
};

export type OrgSummary = { id: string; name: string };

export type OrgMembership = OrgSummary & { role: OrgRole };

export type OrganizationMember = {
  user_id: string;
  email: string | null;
  role: OrgRole;
  created_at: string;
};

export type OrgWithMembers = OrgMembership & { members: OrganizationMember[] };

export type EventWithOrg = EventRow & {
  organization?: OrgSummary | null;
};

export const DEMO_ORG_ID = "11111111-1111-1111-1111-111111111111";

export async function joinOrganization(
  supabase: SupabaseClient,
  orgId: string,
  role: OrgRole = "editor",
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "ログインが必要です" };

  const { error } = await supabase.from("organization_members").insert({
    org_id: orgId,
    user_id: user.id,
    role,
  });

  return { error: error?.message ?? null };
}

export async function createOrganizationWithEvent(
  supabase: SupabaseClient,
  orgName: string,
): Promise<{ slug: string | null; error: string | null }> {
  const name = orgName.trim();
  if (!name) return { slug: null, error: "実行委員会名を入力してください" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { slug: null, error: "ログインが必要です" };

  const orgId = crypto.randomUUID();

  const { error: orgError } = await supabase.from("organizations").insert({ id: orgId, name });
  if (orgError) return { slug: null, error: orgError.message };

  const { error: memberError } = await supabase.from("organization_members").insert({
    org_id: orgId,
    user_id: user.id,
    role: "owner",
  });
  if (memberError) return { slug: null, error: memberError.message };

  const slug = `matsuri-${Date.now()}`;
  const { error: eventError } = await supabase.from("events").insert({
    org_id: orgId,
    slug,
    name: "新しい祭り",
    status: "draft",
    map_zoom: 14,
    map_center: toGeographyEwkt(135.5023, 34.6937),
  });
  if (eventError) return { slug: null, error: eventError.message };

  return { slug, error: null };
}

export async function loadUserOrganizations(supabase: SupabaseClient): Promise<OrgMembership[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("org_id, role, organizations(id, name)")
    .eq("user_id", user.id);

  if (!memberships?.length) return [];

  return memberships
    .map((row) => {
      const raw = row.organizations as OrgSummary | OrgSummary[] | null;
      const org = Array.isArray(raw) ? raw[0] : raw;
      return org ? { id: org.id, name: org.name, role: row.role as OrgRole } : null;
    })
    .filter((org): org is OrgMembership => org != null);
}

export async function loadOrganizationMembers(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OrganizationMember[]> {
  const { data: members, error } = await supabase.rpc("list_org_members", {
    p_org_id: orgId,
  });

  if (error) {
    const { data: fallback } = await supabase
      .from("organization_members")
      .select("user_id, role, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    return (fallback ?? []).map((member) => ({
      ...(member as Omit<OrganizationMember, "email">),
      email: null,
    }));
  }

  return (members ?? []) as OrganizationMember[];
}

function mapInviteError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("user not found")) {
    return "このメールアドレスのアカウントが見つかりません。先に Admin に登録してもらってください。";
  }
  if (normalized.includes("already member")) {
    return "このユーザーはすでに参加しています。";
  }
  if (normalized.includes("permission denied")) {
    return "招待する権限がありません（オーナーのみ）。";
  }
  if (normalized.includes("email required")) {
    return "メールアドレスを入力してください。";
  }
  if (normalized.includes("cannot invite as owner")) {
    return "オーナー権限では招待できません。";
  }
  return message;
}

export async function inviteOrgMember(
  supabase: SupabaseClient,
  input: { orgId: string; email: string; role: Exclude<OrgRole, "owner"> },
): Promise<{ error: string | null }> {
  const email = input.email.trim();
  if (!email) return { error: "メールアドレスを入力してください。" };

  const { error } = await supabase.rpc("invite_org_member", {
    p_org_id: input.orgId,
    p_email: email,
    p_role: input.role,
  });

  return { error: error ? mapInviteError(error.message) : null };
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
