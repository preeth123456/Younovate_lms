// ============================================
// RAZORPAY TEMPORARILY DISABLED
// Younovate LMS is currently deployed without
// payment processing.
// ============================================

import { getRazorpay, RAZORPAY_DISABLED_MESSAGE } from '../../../../lib/razorpay';

export const dynamic = 'force-dynamic';

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
  // const body = await req.json();
  // const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  // verify HMAC signature with RAZORPAY_KEY_SECRET
  // return Response.json({ success: true });

  return Response.json(
    {
      success: false,
      message: RAZORPAY_DISABLED_MESSAGE,
    },
    { status: 503 }
  );
}
