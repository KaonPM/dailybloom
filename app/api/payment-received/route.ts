import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      principalEmail,
      principalName,
      schoolName,
      amount,
      paymentMonth,
      paymentNotes,
    } = body;

    if (!principalEmail || !schoolName || !amount) {
      return NextResponse.json(
        { error: "Missing required payment email details." },
        { status: 400 }
      );
    }

    await resend.emails.send({
      from: "DailyBloom <info@lesedismartsolutions.co.za>",
      to: principalEmail,
      subject: `Payment Received - ${schoolName}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
          <h2>Payment Received</h2>

          <p>Dear ${principalName || "Principal"},</p>

          <p>
            Thank you so much for your payment. This email confirms that
            DailyBloom has received your payment for <strong>${schoolName}</strong>.
          </p>

          <div style="background: #f8fafc; padding: 16px; border-radius: 10px; margin: 20px 0;">
            <p><strong>School:</strong> ${schoolName}</p>
            <p><strong>Amount Received:</strong> R${amount}</p>
            <p><strong>Payment Month:</strong> ${paymentMonth || "Not specified"}</p>
            <p><strong>Payment Notes:</strong> ${paymentNotes || "No notes added"}</p>
          </div>

          <p>
            Please keep this email as confirmation that your payment was received.
          </p>

          <p>
            Kind regards,<br />
            <strong>DailyBloom</strong><br />
            Powered by Lesedi Smart Solutions
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Could not send payment confirmation email." },
      { status: 500 }
    );
  }
}