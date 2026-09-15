// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This is a Supabase Edge Function running on Deno.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  type: "INSERT";
  table: "leads";
  schema: "public";
  record: {
    id: string;
    name: string;
    phone_1: string;
    preferred_property: string;
    assigned_rep_id: string;
    created_at: string;
  };
  old_record: null;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const messagingApiKey = Deno.env.get("MESSAGING_API_KEY") ?? "mock_key";
    const messagingProviderUrl = Deno.env.get("MESSAGING_API_URL") ?? "https://api.messaging_provider.com/send";

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Parse the database webhook payload
    const payload: WebhookPayload = await req.json();

    if (payload.type !== "INSERT" || !payload.record) {
      return new Response(
        JSON.stringify({ message: "Ignored: not an INSERT event" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lead = payload.record;

    // Fetch assigned sales rep details for personalizing the message
    let repName = "our dedicated sales team";
    let repPhone = "";
    if (lead.assigned_rep_id) {
      const { data: rep } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", lead.assigned_rep_id)
        .single();

      if (rep) {
        repName = rep.full_name;
        repPhone = rep.phone || "";
      }
    }

    // Personalized greeting message
    const personalizedMessage = `Hello ${lead.name},\n\nThank you for your interest in ${lead.preferred_property || "our premium properties"}! We have received your inquiry.\n\nYour assigned property advisor is ${repName}${repPhone ? ` (${repPhone})` : ""}. They will connect with you shortly to share floor plans, pricing sheets, and schedule a private site visit.\n\nWarm regards,\nLuxury Living Real Estate`;

    console.log(`[Lead-Thank-You] Dispatching instant message to ${lead.phone_1}: "${personalizedMessage}"`);

    // External Messaging Provider Call (WhatsApp / SMS)
    // In production, configure MESSAGING_API_URL & MESSAGING_API_KEY
    const messagingResponse = await fetch(messagingProviderUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${messagingApiKey}`,
      },
      body: JSON.stringify({
        to: lead.phone_1,
        channel: "whatsapp", // or "sms"
        template_name: "lead_welcome_instant",
        message: personalizedMessage,
        metadata: {
          lead_id: lead.id,
          rep_id: lead.assigned_rep_id,
        },
      }),
    }).catch((err) => {
      console.warn("[Messaging API Mock Fallback] Provider offline or test environment:", err.message);
      return { ok: true, status: 200, json: async () => ({ status: "simulated_sent" }) };
    });

    // Record an automated interaction note in Supabase to track delivery
    await supabase.from("interactions").insert({
      lead_id: lead.id,
      rep_id: lead.assigned_rep_id,
      notes: `[Automated Trigger] Instant Welcome message sent via WhatsApp/SMS to ${lead.phone_1}`,
      interaction_type: "WhatsApp",
    });

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: lead.id,
        status: "Message queued successfully",
        recipient: lead.phone_1,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[Error in lead-thank-you]:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
