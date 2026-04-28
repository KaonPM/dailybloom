import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      requestId,
      schoolName,
      principalName,
      principalEmail,
      primaryColor,
      secondaryColor,
    } = body;

    if (!requestId || !schoolName || !principalName || !principalEmail) {
      return NextResponse.json(
        { error: "Missing required approval details." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase server environment variables." },
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
        school_name: schoolName,
        primary_color: primaryColor || "#7CCCF3",
        secondary_color: secondaryColor || "#FFD76A",
      })
      .select()
      .single();

    if (schoolError) {
      return NextResponse.json({ error: schoolError.message }, { status: 500 });
    }

    const { data: authUser, error: authError } =
      await admin.auth.admin.createUser({
        email: principalEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: principalName,
          role: "principal",
          school_id: school.id,
        },
      });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const userId = authUser.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Principal user was not created." },
        { status: 500 }
      );
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      full_name: principalName,
      email: principalEmail,
      role: "principal",
      school_id: school.id,
      is_active: true,
    });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
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

    await sendOnboardingEmail({
      to: principalEmail,
      principalName,
      schoolName,
      tempPassword,
    });

    return NextResponse.json({
      success: true,
      schoolId: school.id,
      principalEmail,
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

async function sendOnboardingEmail({
  to,
  principalName,
  schoolName,
  tempPassword,
}: {
  to: string;
  principalName: string;
  schoolName: string;
  tempPassword: string;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!resendKey || !fromEmail) {
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject: `Welcome to DailyBloom, ${schoolName}`,
      html: `
        <p>Hello ${principalName},</p>
        <p>Your DailyBloom school account has been approved and created.</p>
        <p><strong>School:</strong> ${schoolName}</p>
        <p><strong>Login email:</strong> ${to}</p>
        <p><strong>Temporary password:</strong> ${tempPassword}</p>
        <p>Please log in here: <a href="${appUrl}/login">${appUrl}/login</a></p>
        <p>After logging in, please update your password.</p>
        <p>Warm regards,<br/>DailyBloom</p>
      `,
    }),
  });
}