import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { schoolId } = body;

    if (!schoolId) {
      return NextResponse.json(
        { error: "School ID is required." },
        { status: 400 }
      );
    }

    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("*")
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: "School not found." },
        { status: 404 }
      );
    }

    const { data: principal, error: principalError } = await supabase
      .from("profiles")
      .select("*")
      .eq("school_id", schoolId)
      .eq("role", "principal")
      .limit(1)
      .single();

    if (principalError || !principal) {
      return NextResponse.json(
        { error: "Principal not found." },
        { status: 404 }
      );
    }

    if (!principal.email) {
      return NextResponse.json(
        { error: "Principal does not have an email address." },
        { status: 400 }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail =
      process.env.DAILYBLOOM_FROM_EMAIL ||
      "DailyBloom <onboarding@resend.dev>";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!resendApiKey) {
      return NextResponse.json(
        { error: "Missing Resend API key." },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);

    const { error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: principal.email,
      subject: `Welcome to DailyBloom, ${school.school_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; background:#FFF8F2; padding:24px;">
          <div style="max-width:640px; margin:0 auto; background:#FFFFFF; border:1px solid #F0E3D8; border-radius:18px; padding:24px;">
            <h1 style="margin:0; color:#2D2A3E;">Welcome to DailyBloom</h1>

            <p style="color:#5B5675; line-height:1.6;">
              Hello ${escapeHtml(principal.full_name || "Principal")},
            </p>

            <p style="color:#5B5675; line-height:1.6;">
              We are pleased to let you know that
              <strong>${escapeHtml(school.school_name || "your school")}</strong>
              has now been activated on DailyBloom.
            </p>

            <p style="color:#5B5675; line-height:1.6;">
              Your onboarding process has been completed and your school is now ready to begin using the platform.
            </p>

            <div style="background:#EAF7FD; border:1px solid #CBEAF7; border-radius:14px; padding:16px; margin:18px 0;">
              <p style="margin:0; color:#2D2A3E;">
                You can log in here:
                <a href="${appUrl}/login" style="color:#2D2A3E; font-weight:bold;">${appUrl}/login</a><a href="${escapeHtml(appUrl)}/login" style="color:#2D2A3E; font-weight:bold;">
  ${escapeHtml(appUrl)}/login
</a>
              </p>
            </div>

            <h2 style="color:#2D2A3E; font-size:20px; margin-top:24px;">What you can do next</h2>

            <ul style="color:#5B5675; line-height:1.8; padding-left:20px;">
              <li>Add classrooms</li>
              <li>Add teachers</li>
              <li>Add learners</li>
              <li>Configure school settings</li>
              <li>Start using attendance and communication tools</li>
              <li>Generate reports and summaries</li>
            </ul>

            <p style="color:#5B5675; line-height:1.6;">
              Thank you for choosing DailyBloom.
            </p>

            <p style="color:#5B5675; line-height:1.6;">
              Warm regards,<br/>
              <strong>DailyBloom Team</strong>
            </p>
          </div>
        </div>
      `,
    });

    if (emailError) {
      console.error("DailyBloom activation email failed:", emailError);

      return NextResponse.json(
        { error: "Failed to send activation email." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Activation email sent successfully.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to send activation email." },
      { status: 500 }
    );
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}