import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type IngestBody = {
  token: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  recorded_at?: string;
  source?: string;
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

    if (!body.token || body.lat == null || body.lng == null) {
      return new Response(JSON.stringify({ error: "invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: trackerId, error: resolveError } = await supabase.rpc(
      "resolve_tracker_by_token",
      { p_token: body.token },
    );

    if (resolveError || !trackerId) {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upsertError } = await supabase.rpc("upsert_location", {
      p_tracker_id: trackerId,
      p_lat: body.lat,
      p_lng: body.lng,
      p_heading: body.heading ?? null,
      p_speed: body.speed ?? null,
      p_accuracy: body.accuracy ?? null,
      p_source: body.source ?? "pwa",
      p_recorded_at: body.recorded_at ?? new Date().toISOString(),
    });

    if (upsertError) {
      const status = upsertError.message.includes("inactive") ? 403 : 500;
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional Broadcast for scale (when REALTIME_MODE=broadcast)
    if (Deno.env.get("REALTIME_MODE") === "broadcast") {
      const { data: location } = await supabase
        .from("tracker_locations")
        .select("*, trackers(name, icon_color, group_name)")
        .eq("tracker_id", trackerId)
        .single();

      if (location) {
        await supabase.channel(`event:${location.event_id}`).send({
          type: "broadcast",
          event: "location_update",
          payload: location,
        });
      }
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
