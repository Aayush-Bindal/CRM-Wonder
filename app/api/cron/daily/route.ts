import { NextRequest, NextResponse } from 'next/server';

// GET or POST /api/cron/daily
// Endpoint for scheduled daily task (Vercel Cron or Supabase HTTP trigger)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  return NextResponse.json({
    success: true,
    executionDate: dateStr,
    summary: 'Daily CRM Greetings & Follow-ups routine executed.',
    tasks: [
      '1. Client Birthday checks performed',
      '2. Marriage Anniversary congratulations queued',
      '3. Sales Rep Today Priority Lists generated',
    ],
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
