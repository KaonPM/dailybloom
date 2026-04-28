import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      requestId,
      schoolName,
      principalFullName,
      principalEmail,
      primaryColor,
      secondaryColor,
    } = body;

    if (!requestId || !schoolName || !principalFullName || !principalEmail) {
      return NextResponse.json(
        { error: "Missing required sign-up approval details." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase server keys." },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const tempPassword = generateTempPassword();

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .insert({
        school_name: schoolName.trim(),
        primary_color: primaryColor || "#7CCCF3",
        secondary_color: secondaryColor || "#FFD76A",
        logo_url: null,
      })
      .select("id, school_name")
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: schoolError?.message || "Could not create school." },
        { status: 500 }
      );
    }

    const { data: authUser, error: authError } =
      await admin.auth.admin.createUser({
        email: principalEmail.trim(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: principalFullName.trim(),
          role: "principal",
          school_id: school.id,
        },
      });

    if (authError || !authUser.user) {
      return NextResponse.json(
        { error: authError?.message || "Could not create principal login." },
        { status: 500 }
      );
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: authUser.user.id,
      full_name: principalFullName.trim(),
      email: principalEmail.trim(),
      role: "principal",
      school_id: school.id,
      approval_status: "approved",
      must_change_password: true,
    });

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    const { error: requestUpdateError } = await admin
      .from("school_signup_requests")
      .update({
        status: "approved",
        school_id: school.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (requestUpdateError) {
      return NextResponse.json(
        { error: requestUpdateError.message },
        { status: 500 }
      );
    }

    await sendPrincipalOnboardingEmail({
      to: principalEmail.trim(),
      principalFullName: principalFullName.trim(),
      schoolName: schoolName.trim(),
      tempPassword,
    });

    return NextResponse.json({
      success: true,
      schoolId: school.id,
      tempPassword,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Approval failed." },
      { status: 500 }
    );
  }
}

function generateTempPassword() {
  const random = Math.random().toString(36).slice(-8);
  return `Bloom@${random}1`;
}

async function sendPrincipalOnboardingEmail({
  to,
  principalFullName,
  schoolName,
  tempPassword,
}: {
  to: string;
  principalFullName: string;
  schoolName: string;
  tempPassword: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.DAILYBLOOM_FROM_EMAIL ||
    "DailyBloom <onboarding@resend.dev>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!resendApiKey) {
    console.warn("RESEND_API_KEY is missing. Onboarding email was not sent.");
    return;
  }

  const resend = new Resend(resendApiKey);

  const { error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject: `Welcome to DailyBloom, ${schoolName}`,
    html: `
      <div style="font-family: Arial, sans-serif; background:#FFF8F2; padding:24px;">
        <div style="max-width:640px; margin:0 auto; background:#FFFFFF; border:1px solid #F0E3D8; border-radius:18px; padding:24px;">
          <h1 style="margin:0; color:#2D2A3E;">Welcome to DailyBloom</h1>

          <p style="color:#5B5675; line-height:1.6;">
            Hello ${escapeHtml(principalFullName)},
          </p>

          <p style="color:#5B5675; line-height:1.6;">
            Your school, <strong>${escapeHtml(schoolName)}</strong>, has been approved on DailyBloom.
            Your principal login has been created.
          </p>

          <div style="background:#EAF7FD; border:1px solid #CBEAF7; border-radius:14px; padding:16px; margin:18px 0;">
            <p style="margin:0 0 8px 0; color:#2D2A3E;"><strong>Login email:</strong> ${escapeHtml(to)}</p>
            <p style="margin:0; color:#2D2A3E;"><strong>Temporary password:</strong> ${escapeHtml(tempPassword)}</p>
          </div>

          <p style="color:#5B5675; line-height:1.6;">
            Please log in here:
            <a href="${appUrl}/login" style="color:#2D2A3E; font-weight:bold;">${appUrl}/login</a>
          </p>

          <p style="color:#5B5675; line-height:1.6;">
            For security, you will be asked to create a new password the first time you log in.
          </p>

          <h2 style="color:#2D2A3E; font-size:20px; margin-top:24px;">Please prepare the following</h2>

          <ul style="color:#5B5675; line-height:1.8; padding-left:20px;">
            <li>School logo</li>
            <li>School colours or brand preference</li>
            <li>Learner list</li>
            <li>Teacher list</li>
            <li>Classroom names</li>
            <li>Events or year planner</li>
            <li>Preferred contact number for parent communication</li>
          </ul>

          <p style="color:#5B5675; line-height:1.6;">
            Warm regards,<br/>
            <strong>DailyBloom Team</strong>
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error("DailyBloom onboarding email failed:", error);
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