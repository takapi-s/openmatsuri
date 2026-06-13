import { ingestViewerLocationSchema, type IngestViewerLocationPayload } from "@openmatsuri/config";

export type PostViewerLocationOptions = {
  endpoint: string;
  anonKey: string;
  sessionToken: string;
  eventId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  recordedAt?: string;
};

export async function postViewerLocation(
  options: PostViewerLocationOptions,
): Promise<{ ok: boolean; error?: string }> {
  const payload: IngestViewerLocationPayload = ingestViewerLocationSchema.parse({
    session_token: options.sessionToken,
    event_id: options.eventId,
    lat: options.lat,
    lng: options.lng,
    accuracy: options.accuracy,
    recorded_at: options.recordedAt ?? new Date().toISOString(),
  });

  const response = await fetch(`${options.endpoint}/functions/v1/ingest-viewer-location`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: text || response.statusText };
  }

  return { ok: true };
}

export const VIEWER_LOCATION_INTERVAL_MS = 120_000;

const CONSENT_KEY_PREFIX = "openmatsuri-viewer-consent:";
const SESSION_KEY_PREFIX = "openmatsuri-viewer-session:";

export function hasViewerLocationConsent(eventId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(`${CONSENT_KEY_PREFIX}${eventId}`) === "1";
}

export function setViewerLocationConsent(eventId: string): void {
  window.localStorage.setItem(`${CONSENT_KEY_PREFIX}${eventId}`, "1");
}

export function clearViewerLocationConsent(eventId: string): void {
  window.localStorage.removeItem(`${CONSENT_KEY_PREFIX}${eventId}`);
}

export function getOrCreateViewerSessionToken(eventId: string): string {
  const key = `${SESSION_KEY_PREFIX}${eventId}`;
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const token = crypto.randomUUID();
  window.localStorage.setItem(key, token);
  return token;
}
