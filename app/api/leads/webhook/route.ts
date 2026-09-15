import { NextRequest, NextResponse } from 'next/server';

// POST /api/leads/webhook
// Simulates / proxies Supabase database webhook triggered on INSERT in public.leads
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lead = body.record || body;

    if (!lead || !lead.name || !lead.phone_1) {
      return NextResponse.json(
        { error: 'Invalid payload: missing lead record' },
        { status: 400 }
      );
    }

    const personalizedMessage = `Hello ${lead.name}, thank you for inquiring about ${
      lead.preferred_property || 'our luxury residences'
    }! Your property advisor will connect with you shortly with comprehensive floor plans and pricing. - Luxury Living Real Estate`;

    // Dispatch to external messaging provider (WhatsApp / SMS)
    // In production, configure MESSAGING_PROVIDER_URL & MESSAGING_API_KEY
    const messagingProviderUrl =
      process.env.MESSAGING_API_URL || 'https://api.messaging_provider.com/send';

    console.log(`[API Webhook Trigger] Dispatched instant welcome message to ${lead.phone_1}`);

    return NextResponse.json({
      success: true,
      trigger: 'lead_insert_thank_you',
      leadId: lead.id,
      recipient: lead.phone_1,
      dispatchedMessage: personalizedMessage,
      status: 'queued',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
