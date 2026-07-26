import { NextResponse } from "next/server";
import { processBillingReceiptOutbox } from "@/app/lib/billing-receipt-delivery";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(
    secret && request.headers.get("authorization") === `Bearer ${secret}`
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await processBillingReceiptOutbox({ batchSize: 50 });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Billing receipt delivery failed.",
      },
      { status: 500 }
    );
  }
}
