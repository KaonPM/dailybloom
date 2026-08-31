import { NextResponse } from "next/server";
import { PERMISSIONS } from "../../lib/permissions";
import { requireStaffPermission, writeSecurityAudit } from "../../lib/server-authorization";
import { supabaseAdmin } from "../../lib/supabase-admin";

const SCHOOL_MANAGED_ROLES = new Set(["teacher", "admin"]);
const PLATFORM_MANAGED_ROLES = new Set(["principal", "owner"]);

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const userId = String(body.user_id || "").trim();
    const schoolId = Number(body.school_id || 0);
    const requestedRole = String(body.role || "").trim().toLowerCase();
    const email = cleanEmail(body.email);

    if (!userId || !email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid account and email address are required." },
        { status: 400 }
      );
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, school_id, role, email")
      .eq("id", userId)
      .maybeSingle();
    if (targetError || !target) {
      return NextResponse.json(
        { error: targetError?.message || "The account could not be found." },
        { status: 404 }
      );
    }

    const targetRole = String(target.role || requestedRole).toLowerCase();
    if (
      !SCHOOL_MANAGED_ROLES.has(targetRole) &&
      !PLATFORM_MANAGED_ROLES.has(targetRole)
    ) {
      return NextResponse.json(
        { error: "This account type cannot be updated here." },
        { status: 400 }
      );
    }

    const targetSchoolId = Number(target.school_id || schoolId || 0);
    const permission = PLATFORM_MANAGED_ROLES.has(targetRole)
      ? PERMISSIONS.PRINCIPAL_MANAGE
      : PERMISSIONS.STAFF_MANAGE;
    const authorization = await requireStaffPermission(
      request,
      permission,
      PLATFORM_MANAGED_ROLES.has(targetRole) ? null : targetSchoolId
    );
    if (!authorization.ok) return authorization.response;

    if (
      PLATFORM_MANAGED_ROLES.has(targetRole) &&
      !["master", "master_admin"].includes(authorization.staff.role)
    ) {
      return NextResponse.json(
        { error: "Only Master or an authorised Master Admin may update a principal email." },
        { status: 403 }
      );
    }
    if (
      targetRole === "admin" &&
      !["principal", "owner", "master"].includes(authorization.staff.role)
    ) {
      return NextResponse.json(
        { error: "Only the Principal or Owner may update a preschool administrator email." },
        { status: 403 }
      );
    }
    if (
      SCHOOL_MANAGED_ROLES.has(targetRole) &&
      (!targetSchoolId || Number(authorization.staff.schoolId || 0) !== targetSchoolId)
    ) {
      return NextResponse.json(
        { error: "The staff account does not belong to the selected school." },
        { status: 403 }
      );
    }

    const { data: duplicate } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .neq("id", userId)
      .limit(1)
      .maybeSingle();
    if (duplicate) {
      return NextResponse.json(
        { error: "That email address is already used by another DailyBloom account." },
        { status: 409 }
      );
    }

    const previousEmail = cleanEmail(target.email);
    if (previousEmail === email) {
      return NextResponse.json({ success: true, email });
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { email, email_confirm: true }
    );
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ email })
      .eq("id", userId);
    if (profileError) {
      if (previousEmail) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          email: previousEmail,
          email_confirm: true,
        });
      }
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    await writeSecurityAudit(authorization.staff, "account.email_updated", {
      target_user_id: userId,
      target_role: targetRole,
      school_id: targetSchoolId || null,
      previous_email: previousEmail,
      new_email: email,
    });

    return NextResponse.json({ success: true, email });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the email address." },
      { status: 400 }
    );
  }
}
