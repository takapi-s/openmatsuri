import {
  ingestLocationSchema,
  type IngestLocationPayload,
  type LocationSource,
} from "@openmatsuri/config";

export type PostLocationOptions = {
  endpoint: string;
  anonKey: string;
  token: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  source?: LocationSource;
  recordedAt?: string;
};

export async function postLocation(
  options: PostLocationOptions,
): Promise<{ ok: boolean; error?: string }> {
  const payload: IngestLocationPayload = ingestLocationSchema.parse({
    token: options.token,
    lat: options.lat,
    lng: options.lng,
    heading: options.heading,
    speed: options.speed,
    accuracy: options.accuracy,
    recorded_at: options.recordedAt ?? new Date().toISOString(),
    source: options.source ?? "pwa",
  });

  const response = await fetch(`${options.endpoint}/functions/v1/ingest-location`, {
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

export const INGEST_LOCATION_OPENAPI = {
  post: {
    summary: "Ingest tracker location",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["token", "lat", "lng"],
            properties: {
              token: { type: "string", format: "uuid" },
              lat: { type: "number" },
              lng: { type: "number" },
              heading: { type: "number" },
              speed: { type: "number" },
              accuracy: { type: "number" },
              recorded_at: { type: "string", format: "date-time" },
              source: {
                type: "string",
                enum: ["pwa", "android_agent", "pi_agent", "soracom", "traccar"],
              },
            },
          },
        },
      },
    },
  },
} as const;
