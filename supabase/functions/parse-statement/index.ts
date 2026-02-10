// parse-statement/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("NORTH_PROJECT_URL") || Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("NORTH_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    console.log("parse-statement invoked body:", body);

    const { upload_id, guest_token, trace_id } = body;

    if (!upload_id || !guest_token) {
      return new Response(JSON.stringify({ error: "Missing upload_id or guest_token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Create Job Row
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .insert({ upload_id, status: "queued" })
      .select()
      .single();

    if (jobErr || !job) {
      console.error("jobs insert failed:", jobErr);
      return new Response(JSON.stringify({ error: "Failed to create job", detail: jobErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Mark upload as processing immediately
    const { error: upErr } = await supabase
      .from("upload")
      .update({
        status: "processing",
        progress: 5,
        processing_stage: "starting",
        trace_id: trace_id ?? null,
      })
      .eq("id", upload_id)
      .eq("guest_token", guest_token);

    if (upErr) {
      console.warn("upload update warning:", upErr);
    }

    // 3) Trigger Worker (process-job)
    const triggerUrl = `${SUPABASE_URL}/functions/v1/process-job`;

    console.log("🔁 Triggering worker:", {
      triggerUrl,
      hasServiceKey: !!SERVICE_KEY,
      upload_id,
      trace_id,
    });

    let triggerRes: Response;
    let triggerText = "";

    try {
      triggerRes = await fetch(triggerUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ job_id: job.id, trace_id }),
      });

      triggerText = await triggerRes.text().catch(() => "");
      console.log("✅ process-job trigger response:", {
        status: triggerRes.status,
        statusText: triggerRes.statusText,
        bodyPreview: triggerText.slice(0, 800),
      });
    } catch (e) {
      console.error("❌ process-job trigger fetch threw:", String(e));
      throw new Error(`Failed to start background worker: fetch_failed: ${String(e)}`);
    }

    if (!triggerRes.ok) {
      // IMPORTANT: include response body so you can see the real issue
      throw new Error(
        `Failed to start background worker: status=${triggerRes.status} body=${triggerText.slice(0, 800)}`
      );
    }

    return new Response(JSON.stringify({ success: true, job_id: job.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("parse-statement fatal:", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
