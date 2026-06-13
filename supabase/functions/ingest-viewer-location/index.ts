import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type IngestBody = {
  session_token: string;
  event_id: string;
  lat: number;
  lng: number;
  accuracy?: number;
  recorded_at?: string;
};

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

  try {
    const body = (await req.json()) as IngestBody;

    if (!body.session_token || !body.event_id || body.lat == null || body.lng == null) {
      return new Response(JSON.stringify({ error: "invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: ingestError } = await supabase.rpc("ingest_viewer_location", {
      p_session_token: body.session_token,
      p_event_id: body.event_id,
      p_lat: body.lat,
      p_lng: body.lng,
      p_accuracy: body.accuracy ?? null,
      p_recorded_at: body.recorded_at ?? new Date().toISOString(),
    });

    if (ingestError) {
      const status = ingestError.message.includes("not live") ? 403 : 500;
      return new Response(JSON.stringify({ error: ingestError.message }), {
        status,
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
