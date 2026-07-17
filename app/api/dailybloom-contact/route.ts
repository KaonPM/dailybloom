import { NextResponse } from "next/server";
import { Resend } from "resend";
import { enforceRateLimit } from "@/app/lib/rate-limit";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const limited = await enforceRateLimit(request, "public-contact", 5, 3600, String(body.email || ""));
    if (limited) return limited;

    const { name, email, phone, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email and message are required." },
        { status: 400 }
      );
    }

    // 1. EMAIL TO YOU (DailyBloom inbox)
    await resend.emails.send({
      from: "DailyBloom <info@dailybloom.co.za>", // change later when domain verified
      to: "info@dailybloom.co.za",
      replyTo: email,
      subject: `New DailyBloom enquiry from ${name}`,
      html: `
        <h2>New Contact Form Enquiry</h2>
        <p><strong>Name:</strong> ${escapeHtml(String(name))}</p>
        <p><strong>Email:</strong> ${escapeHtml(String(email))}</p>
        <p><strong>Phone:</strong> ${escapeHtml(String(phone || "Not provided"))}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(String(message))}</p>
      `,
    });

    // 2. AUTO RESPONSE TO SENDER
    await resend.emails.send({
      from: "DailyBloom <info@dailybloom.co.za>", // same note here
      to: email,
      subject: "We Have Received Your Email",
      html: `
        <p>Dear ${escapeHtml(String(name))},</p>

        <p>Thank you for reaching out to DailyBloom.</p>

        <p>
          This is an automated confirmation that we have received your email.
          A member of our team will review your message and get back to you shortly.
        </p>

        <p><strong>Our Operating Hours:</strong><br/>
        Monday – Friday | 08:00 – 17:00</p>

        <p>
          Please note that we are closed on weekends and public holidays.
          Emails received outside of business hours will be attended to on the next available working day.
        </p>

        <p>
          If your matter is urgent, please include <strong>URGENT</strong> in the subject line of your reply
          and we will prioritise your request.
        </p>

        <p>
          We appreciate your patience and look forward to assisting you.
        </p>

        <p>
          Warm regards,<br/>
          DailyBloom<br/>
          📧 info@dailybloom.co.za<br/>
          🌐 www.dailybloom.co.za
        </p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("EMAIL ERROR:", error);

    return NextResponse.json(
      { error: "Could not send emails." },
      { status: 500 }
    );
  }
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
