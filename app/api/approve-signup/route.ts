import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { requireStaffPermission, writeSecurityAudit } from "../../lib/server-authorization";
import { PERMISSIONS } from "../../lib/permissions";

const DAILYBLOOM_URL = "https://www.dailybloom.co.za";

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
      isSponsored,
      sponsorProgrammeId,
    } = body;
    const authorization = await requireStaffPermission(request, PERMISSIONS.SCHOOL_ONBOARD);
    if (!authorization.ok) return authorization.response;

    const packageSelected =
      body.packageSelected || body.packageName || body.selectedPackage || "Bloom";

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

    const { data: existingRequest, error: existingRequestError } = await admin
      .from("school_signup_requests")
      .select("id, status, school_id")
      .eq("id", requestId)
      .single();

    if (existingRequestError || !existingRequest) {
      return NextResponse.json(
        { error: "Signup request not found." },
        { status: 404 }
      );
    }

    if (existingRequest.status === "approved" && existingRequest.school_id) {
      return NextResponse.json({
        success: true,
        schoolId: existingRequest.school_id,
        message: "This signup request has already been approved.",
      });
    }

    const tempPassword = generateTempPassword();

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .insert({
        school_name: schoolName.trim(),
        primary_color: primaryColor || "#7CCCF3",
        secondary_color: secondaryColor || "#FFD76A",
        logo_url: null,
        package_name: packageSelected,
        is_sponsored: Boolean(isSponsored),
        sponsor_programme_id:
          isSponsored && sponsorProgrammeId
            ? Number(sponsorProgrammeId)
            : null,
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
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const { error: requestUpdateError } = await admin
      .from("school_signup_requests")
      .update({
        status: "approved",
        onboarding_status: "awaiting_payment",
        setup_fee_paid: false,
        subscription_paid: false,
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
      packageSelected,
      tempPassword,
    });
    await admin.from("school_memberships").upsert({ user_id: authUser.user.id, school_id: school.id, role: "principal", status: "active", accepted_at: new Date().toISOString() }, { onConflict: "user_id,school_id" });
    await writeSecurityAudit(authorization.staff, "school.signup_approved", { school_id: school.id, request_id: requestId });

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
  packageSelected,
  tempPassword,
}: {
  to: string;
  principalFullName: string;
  schoolName: string;
  packageSelected: string;
  tempPassword: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.DAILYBLOOM_FROM_EMAIL || "DailyBloom <onboarding@resend.dev>";

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
        Please log in to DailyBloom here:
        <a href="${DAILYBLOOM_URL}/login" style="color:#2D2A3E; font-weight:bold;">${DAILYBLOOM_URL}/login</a>
      </p>

      <p style="color:#5B5675; line-height:1.6;">
        For security, you will be asked to create a new password the first time you log in.
      </p>

      <h2 style="color:#2D2A3E; font-size:20px; margin-top:24px;">Selected Package</h2>

      <p style="color:#5B5675; line-height:1.6;">
        Your selected package: <strong>${escapeHtml(packageSelected)}</strong>
      </p>

      <h2 style="color:#2D2A3E; font-size:20px; margin-top:24px;">Next Steps</h2>

      <ol style="color:#5B5675; line-height:1.8; padding-left:20px;">
        <li>Submit the required onboarding information listed below.</li>
        <li>DailyBloom will review and confirm receipt.</li>
        <li>An onboarding visit or virtual setup session will be scheduled.</li>
        <li>Your school information will be configured and imported.</li>
        <li>Principal and staff onboarding training will be conducted.</li>
        <li>Your school will be activated for daily use.</li>
      </ol>

      <h2 style="color:#2D2A3E; font-size:20px; margin-top:24px;">
        Information Required for Onboarding
      </h2>

      <p style="color:#5B5675; line-height:1.6;">
        To begin the onboarding process, please email the following information and supporting documents to
        <strong>info@dailybloom.co.za</strong>.
      </p>

      <ul style="color:#5B5675; line-height:1.8; padding-left:20px;">
        <li>Proof of payment for the once-off setup fee</li>
        <li>Proof of payment for the first monthly subscription fee</li>
        <li>School logo</li>
        <li>Primary school colour</li>
        <li>Secondary school colour</li>
        <li>School contact details, including address, telephone number and email address</li>
        <li>Learner list or learner register, in Excel, PDF or register copy format</li>
        <li>Teacher list</li>
        <li>Classroom list</li>
        <li>Year planner or school events calendar</li>
      </ul>

      <h2 style="color:#2D2A3E; font-size:20px; margin-top:24px;">What the once-off setup fee covers</h2>

      <ul style="color:#5B5675; line-height:1.8; padding-left:20px;">
        <li>Initial school setup</li>
        <li>System configuration</li>
        <li>School branding setup</li>
        <li>Classroom setup</li>
        <li>Learner setup or import support</li>
        <li>Teacher setup</li>
        <li>Principal onboarding</li>
        <li>Staff training and onboarding support</li>
      </ul>

      <p style="color:#5B5675; line-height:1.6;">
        Depending on your location and onboarding requirements, DailyBloom may arrange an in-person or virtual onboarding session
        to assist with the setup and migration of your school information.
      </p>

      <div style="background:#FFF7D9; border:1px solid #F3E4A3; border-radius:14px; padding:16px; margin:18px 0;">
        <p style="margin:0 0 8px 0; color:#2D2A3E;"><strong>Your onboarding contact</strong></p>
        <p style="margin:0; color:#5B5675; line-height:1.6;">
          Kaone Setae<br/>
          076 361 6044<br/>
          info@dailybloom.co.za
        </p>
      </div>

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
