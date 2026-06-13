import { z } from "zod";

export const eventStatusSchema = z.enum(["draft", "live", "archived"]);
export const deviceTypeSchema = z.enum([
  "pwa",
  "soracom_lte",
  "android_agent",
  "pi_agent",
  "external",
]);
export const poiKindSchema = z.enum([
  "toilet",
  "parking",
  "shelter",
  "food",
  "other",
]);
export const orgRoleSchema = z.enum(["owner", "editor", "viewer"]);
export const locationSourceSchema = z.enum([
  "pwa",
  "android_agent",
  "pi_agent",
  "soracom",
  "traccar",
]);

export const ingestLocationSchema = z.object({
  token: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().optional(),
  speed: z.number().optional(),
  accuracy: z.number().optional(),
  recorded_at: z.string().datetime().optional(),
  source: locationSourceSchema.default("pwa"),
});

export const ingestViewerLocationSchema = z.object({
  session_token: z.string().uuid(),
  event_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  recorded_at: z.string().datetime().optional(),
});

export const soracomPayloadSchema = z.object({
  lat: z.number(),
  lon: z.number().optional(),
  lng: z.number().optional(),
  battery: z.number().optional(),
  timestamp: z.union([z.number(), z.string()]).optional(),
});

export type EventStatus = z.infer<typeof eventStatusSchema>;
export type DeviceType = z.infer<typeof deviceTypeSchema>;
export type PoiKind = z.infer<typeof poiKindSchema>;
export type OrgRole = z.infer<typeof orgRoleSchema>;
export type LocationSource = z.infer<typeof locationSourceSchema>;
export type IngestLocationPayload = z.infer<typeof ingestLocationSchema>;
export type IngestViewerLocationPayload = z.infer<typeof ingestViewerLocationSchema>;
export type SoracomPayload = z.infer<typeof soracomPayloadSchema>;

export const POI_KIND_LABELS: Record<PoiKind, string> = {
  toilet: "トイレ",
  parking: "駐車場",
  shelter: "休憩所",
  food: "飲食",
  other: "その他",
};

export const POI_KIND_COLORS: Record<PoiKind, string> = {
  toilet: "#2563eb",
  parking: "#6366f1",
  shelter: "#16a34a",
  food: "#d97706",
  other: "#64748b",
};

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  pwa: "PWA（ブラウザ）",
  soracom_lte: "SORACOM LTE GPS",
  android_agent: "Android Agent",
  pi_agent: "Raspberry Pi",
  external: "外部デバイス",
};

export const DEFAULT_MAP_STYLE =
  "https://tiles.openfreemap.org/styles/liberty";

/** PostGIS geography 列への INSERT 用（GeoJSON オブジェクトは不可） */
export function toGeographyEwkt(lng: number, lat: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

/** PostGIS geography 列（LineString）への INSERT 用 */
export function toGeographyLineStringEwkt(coordinates: [number, number][]): string {
  const coords = coordinates.map(([lng, lat]) => `${lng} ${lat}`).join(", ");
  return `SRID=4326;LINESTRING(${coords})`;
}
