import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "../../lib/permissions";
import { requireStaffPermission, writeSecurityAudit } from "../../lib/server-authorization";
import { sendLoginEmail } from "../../lib/send-login-email";
import { supabaseAdmin } from "../../lib/supabase-admin";

function generateTemporaryPassword() {
  return `Bloom@${randomBytes(6).toString("base64url")}1`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const authorization = await requireStaffPermission(
      request,
      PERMISSIONS.PLATFORM_ADMIN_MANAGE
    );
    if (!authorization.ok) return authorization.response;
    if (!email) {
      return NextResponse.json({ error: "Master Admin email is required." }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .eq("role", "master_admin")
      .maybeSingle();
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }
    if (!profile) {
      return NextResponse.json({ error: "Master Admin profile not found." }, { status: 404 });
    }

    const temporaryPassword = generateTemporaryPassword();
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      { password: temporaryPassword, email_confirm: true }
    );
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true, is_active: true })
      .eq("id", profile.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await sendLoginEmail({
      toEmail: profile.email,
      fullName: profile.full_name,
      temporaryPassword,
      roleLabel: "Master Admin",
    });
    await writeSecurityAudit(authorization.staff, "master_admin.login_reset", {
      master_admin_id: profile.id,
    });

    return NextResponse.json({
      success: true,
      message: "Master Admin login email resent with a new temporary password.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not resend Master Admin login email.",
      },
      { status: 500 }
    );
  }
}
