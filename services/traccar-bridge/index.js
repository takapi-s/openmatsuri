/**
 * Traccar Bridge — TK102 系 GPS トラッカー → OpenMATSURI Ingest API
 *
 * Usage:
 *   TRACCAR_WEBHOOK_PORT=8080 \
 *   INGEST_ENDPOINT=http://127.0.0.1:54321/functions/v1/ingest-location \
 *   SUPABASE_ANON_KEY=... \
 *   DEVICE_MAP='{"device-id":"tracker-token-uuid"}' \
 *   node index.js
 */

import http from "node:http";

const PORT = Number(process.env.TRACCAR_WEBHOOK_PORT ?? 8080);
const INGEST = process.env.INGEST_ENDPOINT!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const DEVICE_MAP: Record<string, string> = JSON.parse(process.env.DEVICE_MAP ?? "{}");

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end();
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  try {
    const event = JSON.parse(body);
    const deviceId = String(event.deviceId ?? event.device?.uniqueId ?? "");
    const token = DEVICE_MAP[deviceId];
    if (!token) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unknown device" }));
      return;
    }

    const lat = event.position?.latitude ?? event.latitude;
    const lng = event.position?.longitude ?? event.longitude;

    const ingestRes = await fetch(INGEST, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        lat,
        lng,
        speed: event.position?.speed,
        heading: event.position?.course,
        source: "traccar",
      }),
    });

    res.writeHead(ingestRes.status, { "Content-Type": "application/json" });
    res.end(await ingestRes.text());
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(e) }));
  }
});

server.listen(PORT, () => {
  console.log(`Traccar bridge listening on :${PORT}`);
});
