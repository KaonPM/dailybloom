import { NextResponse } from "next/server";
import { processEnrolmentWhatsAppDeliveryRetries } from "@/app/lib/enrolment-whatsapp-delivery";

function isAuthorized(request: Request) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  return Boolean(configuredSecret && request.headers.get("authorization") === `Bearer ${configuredSecret}`);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const result = await processEnrolmentWhatsAppDeliveryRetries();
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return new NextResponse("Enrolment WhatsApp delivery retry failed", { status: 500 });
  }
}
