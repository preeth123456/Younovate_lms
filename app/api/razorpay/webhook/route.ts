// ============================================
// RAZORPAY TEMPORARILY DISABLED
// Younovate LMS is currently deployed without
// payment processing.
// ============================================

import { getRazorpay, RAZORPAY_DISABLED_MESSAGE } from '../../../../lib/razorpay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Deprecated Pages Router config (preserved for future enablement):
// export const config = { api: { bodyParser: false } }

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(req: Request) {
  const razorpay = getRazorpay();

  if (!razorpay) {
    return Response.json(
      {
        success: false,
        message: RAZORPAY_DISABLED_MESSAGE,
      },
      { status: 503 }
    );
  }

  // --- Enable when Razorpay is active ---
  // const ip = getClientIp(req);
  // const rawBody = await req.text();
  // verify webhook signature with raw body bytes

  void getClientIp(req);
  return Response.json(
    {
      success: false,
      message: RAZORPAY_DISABLED_MESSAGE,
    },
    { status: 503 }
  );
}
