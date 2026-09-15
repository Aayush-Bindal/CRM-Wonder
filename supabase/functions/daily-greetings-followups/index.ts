// Supabase Edge Function: Daily Greetings & Follow-ups Automation
// Scheduled to run once daily (e.g. 08:00 AM) via Supabase pg_cron or HTTP Cron

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Known festival calendar (MM-DD)
const ANNUAL_FESTIVALS: Record<string, string> = {
  "01-01": "Happy New Year! Wishing you and your family prosperity and a wonderful year ahead.",
  "07-04": "Happy 4th of July! Wishing you a joyous celebration with family and friends.",
  "10-31": "Happy Halloween from all of us at Luxury Living Real Estate!",
  "11-26": "Warm Thanksgiving wishes to you and your loved ones! Grateful for your trust.",
  "12-25": "Merry Christmas! Wishing you joy, warmth, and peace this festive season.",
  "12-31": "Wishing you health, happiness, and great success in the upcoming New Year!",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const messagingApiKey = Deno.env.get("MESSAGING_API_KEY") ?? "mock_key";
    const messagingProviderUrl = Deno.env.get("MESSAGING_API_URL") ?? "https://api.messaging_provider.com/send";

    // Service role client to query across all tables without RLS restriction
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    const currentDay = String(now.getDate()).padStart(2, "0");
    const currentDateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const monthDayStr = `${currentMonth}-${currentDay}`; // MM-DD

    const results = {
      birthdaysSent: 0,
      anniversariesSent: 0,
      festivalGreetingsSent: 0,
      repPriorityListsGenerated: 0,
      totalPendingFollowupsToday: 0,
    };

    // ------------------------------------------------------------------------
    // CHECK 1: Birthday Greetings (dob month & day matches today)
    // ------------------------------------------------------------------------
    const { data: birthdayLeads, error: bdayError } = await supabase
      .from("leads")
      .select("id, name, phone_1, assigned_rep_id, dob")
      .not("dob", "is", null);

    if (!bdayError && birthdayLeads) {
      for (const lead of birthdayLeads) {
        if (!lead.dob) continue;
        const [_, m, d] = lead.dob.split("-");
        if (m === currentMonth && d === currentDay) {
          const message = `Dear ${lead.name},\n\nWishing you a very Happy Birthday from all of us at Luxury Living Real Estate! May the year ahead bring you immense joy, success, and prosperity.\n\nWarmest wishes,\nYour Property Advisory Team`;
          
          console.log(`[Birthday Trigger] Sending to ${lead.name} (${lead.phone_1})`);
          
          await fetch(messagingProviderUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${messagingApiKey}`,
            },
            body: JSON.stringify({
              to: lead.phone_1,
              message,
              type: "birthday_greeting",
            }),
          }).catch(() => null);

          await supabase.from("interactions").insert({
            lead_id: lead.id,
            rep_id: lead.assigned_rep_id,
            notes: `[Automated Trigger] Sent Birthday Greeting via WhatsApp/SMS to ${lead.phone_1}`,
            interaction_type: "WhatsApp",
          });

          results.birthdaysSent++;
        }
      }
    }

    // ------------------------------------------------------------------------
    // CHECK 2: Marriage Anniversary Greetings (anniversary matches today)
    // ------------------------------------------------------------------------
    const { data: anniversaryLeads, error: annivError } = await supabase
      .from("leads")
      .select("id, name, phone_1, assigned_rep_id, marriage_anniversary")
      .not("marriage_anniversary", "is", null);

    if (!annivError && anniversaryLeads) {
      for (const lead of anniversaryLeads) {
        if (!lead.marriage_anniversary) continue;
        const [_, m, d] = lead.marriage_anniversary.split("-");
        if (m === currentMonth && d === currentDay) {
          const message = `Heartiest Congratulations ${lead.name}!\n\nWishing you and your spouse a very Happy Wedding Anniversary! May your bond grow stronger and your home be filled with endless love and laughter.\n\nWarm regards,\nLuxury Living Real Estate`;

          console.log(`[Anniversary Trigger] Sending to ${lead.name} (${lead.phone_1})`);

          await fetch(messagingProviderUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${messagingApiKey}`,
            },
            body: JSON.stringify({
              to: lead.phone_1,
              message,
              type: "anniversary_greeting",
            }),
          }).catch(() => null);

          await supabase.from("interactions").insert({
            lead_id: lead.id,
            rep_id: lead.assigned_rep_id,
            notes: `[Automated Trigger] Sent Wedding Anniversary Greeting to ${lead.phone_1}`,
            interaction_type: "WhatsApp",
          });

          results.anniversariesSent++;
        }
      }
    }

    // ------------------------------------------------------------------------
    // CHECK 3: Predefined Holiday / Festival Greetings
    // ------------------------------------------------------------------------
    if (ANNUAL_FESTIVALS[monthDayStr]) {
      const festivalGreeting = ANNUAL_FESTIVALS[monthDayStr];
      const { data: allActiveLeads } = await supabase
        .from("leads")
        .select("id, name, phone_1, assigned_rep_id")
        .in("status", ["New", "Contacted", "Site Visit", "Negotiation"]);

      if (allActiveLeads) {
        for (const lead of allActiveLeads) {
          const personalizedHoliday = `Dear ${lead.name},\n\n${festivalGreeting}\n\nWarm regards,\nLuxury Living Real Estate`;
          await fetch(messagingProviderUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${messagingApiKey}`,
            },
            body: JSON.stringify({
              to: lead.phone_1,
              message: personalizedHoliday,
              type: "festival_greeting",
            }),
          }).catch(() => null);

          results.festivalGreetingsSent++;
        }
      }
    }

    // ------------------------------------------------------------------------
    // CHECK 4: INTERNAL LOGIC - Auto-populate Today's Priority List for Sales Reps
    // Query followups table where followup_date = CURRENT_DATE and status = 'Pending'
    // ------------------------------------------------------------------------
    const { data: todayFollowups, error: followupsError } = await supabase
      .from("followups")
      .select(`
        id,
        followup_date,
        status,
        rep_id,
        lead_id,
        lead:leads ( id, name, phone_1, preferred_property )
      `)
      .eq("followup_date", currentDateStr)
      .eq("status", "Pending");

    if (!followupsError && todayFollowups) {
      results.totalPendingFollowupsToday = todayFollowups.length;

      // Group by Sales Rep
      const repMap: Record<string, typeof todayFollowups> = {};
      for (const item of todayFollowups) {
        if (!repMap[item.rep_id]) {
          repMap[item.rep_id] = [];
        }
        repMap[item.rep_id].push(item);
      }

      results.repPriorityListsGenerated = Object.keys(repMap).length;

      // Send a morning summary ping to each Sales Rep
      for (const [repId, repFollowups] of Object.entries(repMap)) {
        const { data: repProfile } = await supabase
          .from("profiles")
          .select("full_name, phone, email")
          .eq("id", repId)
          .single();

        if (repProfile && repProfile.phone) {
          const digest = `Good morning ${repProfile.full_name}!\n\nYou have ${repFollowups.length} scheduled follow-ups waiting on your Priority List today.\n\nOpen your CRM dashboard: https://crm.yourdomain.com\n\nMake today count!`;
          
          await fetch(messagingProviderUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${messagingApiKey}`,
            },
            body: JSON.stringify({
              to: repProfile.phone,
              message: digest,
              type: "daily_rep_priority_digest",
            }),
          }).catch(() => null);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: currentDateStr,
        metrics: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Error in daily-greetings-followups]:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
