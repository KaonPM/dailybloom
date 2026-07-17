import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendLoginEmail } from "../../lib/send-login-email";
import { requireStaffPermission, writeSecurityAudit } from "../../lib/server-authorization";
import { PERMISSIONS } from "../../lib/permissions";

function generateTempPassword() {
  const randomPart = Math.random().toString(36).slice(-8);
  return `Bloom@${randomPart}1`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = String(body.email || "").trim().toLowerCase();
    const schoolId = Number(body.school_id);
    const authorization = await requireStaffPermission(request, PERMISSIONS.STAFF_MANAGE, schoolId);
    if (!authorization.ok) return authorization.response;

    if (!email) {
      return NextResponse.json(
        { error: "Teacher email is required." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase service role key." },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, email, role, school_id")
      .eq("email", email)
      .eq("school_id", schoolId)
      .eq("role", "teacher")
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Teacher profile not found." },
        { status: 404 }
      );
    }

    const newPassword = generateTempPassword();

    const { error: updateAuthError } = await admin.auth.admin.updateUserById(
      profile.id,
      {
        password: newPassword,
        email_confirm: true,
      }
    );

    if (updateAuthError) {
      return NextResponse.json(
        { error: updateAuthError.message },
        { status: 400 }
      );
    }

    const { error: updateProfileError } = await admin
      .from("profiles")
      .update({
        must_change_password: true,
      })
      .eq("id", profile.id);

    if (updateProfileError) {
      return NextResponse.json(
        { error: updateProfileError.message },
        { status: 400 }
      );
    }

    await sendLoginEmail({
      toEmail: profile.email,
      fullName: profile.full_name,
      temporaryPassword: newPassword,
      roleLabel: "teacher",
    });
    await writeSecurityAudit(authorization.staff, "teacher.login_reset", { teacher_id: profile.id, school_id: schoolId });

    return NextResponse.json({
      success: true,
      message: "Teacher login email resent with a new temporary password.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not resend teacher login email." },
      { status: 500 }
    );
  }
}
