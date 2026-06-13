import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-soracom-sim-id, x-soracom-signature",
};

type SoracomBody = {
  lat?: number;
  lon?: number;
  lng?: number;
  battery?: number;
  timestamp?: number | string;
};

function verifyBeamSignature(req: Request): boolean {
  const secret = Deno.env.get("SORACOM_BEAM_SECRET");
  if (!secret) return false;
  const signature = req.headers.get("x-soracom-signature");
  if (!signature) return false;
  return signature === secret;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!verifyBeamSignature(req)) {
    return new Response(JSON.stringify({ error: "invalid beam signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const simId = req.headers.get("x-soracom-sim-id");
  if (!simId) {
    return new Response(JSON.stringify({ error: "missing sim id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let body: SoracomBody;
    const raw = await req.text();
    try {
      body = JSON.parse(raw);
    } catch {
      // Base64 encoded payload fallback
      body = JSON.parse(atob(raw));
    }

    const lat = body.lat;
    const lng = body.lon ?? body.lng;
    if (lat == null || lng == null) {
      return new Response(JSON.stringify({ error: "missing coordinates" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: trackerId, error: resolveError } = await supabase.rpc(
      "resolve_tracker_by_sim",
      { p_sim_id: simId },
    );

    if (resolveError || !trackerId) {
      return new Response(JSON.stringify({ error: "unknown sim" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recordedAt = body.timestamp
      ? new Date(
          typeof body.timestamp === "number"
            ? body.timestamp * 1000
            : body.timestamp,
        ).toISOString()
      : new Date().toISOString();

    const { error: upsertError } = await supabase.rpc("upsert_location", {
      p_tracker_id: trackerId,
      p_lat: lat,
      p_lng: lng,
      p_heading: null,
      p_speed: null,
      p_accuracy: null,
      p_source: "soracom",
      p_recorded_at: recordedAt,
    });

    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
