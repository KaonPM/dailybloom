import { NextResponse } from "next/server";
import { PERMISSIONS } from "../../lib/permissions";
import {
  canManageRole,
  isManagedRole,
  managedRoleLabel,
  validateManagedPermissions,
} from "../../lib/role-management";
import { requireStaffPermission, writeSecurityAudit } from "../../lib/server-authorization";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { sendLoginEmail } from "../../lib/send-login-email";

const ACTIVE_STATUSES = new Set(["invited", "active", "suspended", "revoked"]);
const STRONG_PASSWORD = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function authorizeRoleManagement(request: Request, role: string, schoolId?: number) {
  const permission = role === "master_admin"
    ? PERMISSIONS.PLATFORM_ADMIN_MANAGE
    : role === "owner"
      ? PERMISSIONS.PRINCIPAL_MANAGE
      : PERMISSIONS.STAFF_MANAGE;
  return requireStaffPermission(request, permission, schoolId || null);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const role = String(url.searchParams.get("role") || "").toLowerCase();
  const schoolId = Number(url.searchParams.get("school_id") || 0);
  if (!isManagedRole(role)) {
    return NextResponse.json({ error: "A supported role is required." }, { status: 400 });
  }
  if (role !== "master_admin" && !schoolId) {
    return NextResponse.json({ error: "School context is required." }, { status: 400 });
  }

  const authorization = await authorizeRoleManagement(request, role, schoolId);
  if (!authorization.ok) return authorization.response;
  if (!canManageRole(authorization.staff.role, role)) {
    return NextResponse.json({ error: `You cannot manage ${managedRoleLabel(role)} accounts.` }, { status: 403 });
  }

  const table = role === "master_admin" ? "platform_user_roles" : "school_memberships";
  const columns = role === "master_admin"
    ? "user_id, role, status, permissions, assigned_at, updated_at"
    : "user_id, role, status, permissions, created_at, updated_at";
  let query = supabaseAdmin.from(table).select(columns).eq("role", role);
  if (role !== "master_admin") query = query.eq("school_id", schoolId);
  const { data: assignments, error } = await query.order(
    role === "master_admin" ? "assigned_at" : "created_at",
    { ascending: false }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const userIds = (assignments || []).map((assignment) => assignment.user_id);
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name, email, is_active, last_login_at").in("id", userIds)
    : { data: [], error: null };
  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 400 });
  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return NextResponse.json({
    assignments: (assignments || []).map((assignment) => ({
      ...assignment,
      profile: profileById.get(assignment.user_id) || null,
    })),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const role = String(body.role || "").toLowerCase();
    const schoolId = Number(body.school_id || 0);
    const fullName = String(body.full_name || "").trim();
    const email = cleanEmail(body.email);
    const password = String(body.password || "").trim();
    if (!isManagedRole(role)) {
      return NextResponse.json({ error: "A supported role is required." }, { status: 400 });
    }
    if (!fullName || !email || (role !== "master_admin" && !schoolId)) {
      return NextResponse.json({ error: "Name, email and the required role context must be provided." }, { status: 400 });
    }
    if (role === "admin" && !STRONG_PASSWORD.test(password)) {
      return NextResponse.json(
        { error: "Temporary password must be at least 8 characters and include letters, numbers and a special character." },
        { status: 400 }
      );
    }

    const authorization = await authorizeRoleManagement(request, role, schoolId);
    if (!authorization.ok) return authorization.response;
    if (!canManageRole(authorization.staff.role, role)) {
      return NextResponse.json({ error: `You cannot manage ${managedRoleLabel(role)} accounts.` }, { status: 403 });
    }
    const permissions = validateManagedPermissions(role, body.permissions);

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, school_id, role")
      .eq("email", email)
      .maybeSingle();
    if (existingProfile && role !== "master_admin" && Number(existingProfile.school_id || 0) !== schoolId) {
      return NextResponse.json(
        { error: "This email already belongs to a different school account." },
        { status: 409 }
      );
    }

    let userId = existingProfile?.id as string | undefined;
    let invited = false;
    if (!userId) {
      const { data, error } = role === "admin"
        ? await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName, role, school_id: schoolId },
          })
        : await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.dailybloom.co.za"}/login`,
            data: { full_name: fullName, role, school_id: role === "master_admin" ? null : schoolId },
          });
      if (error || !data.user?.id) {
        return NextResponse.json({ error: error?.message || "Could not create the invitation." }, { status: 400 });
      }
      userId = data.user.id;
      invited = role !== "admin";
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
        id: userId,
        full_name: fullName,
        email,
        role,
        school_id: role === "master_admin" ? null : schoolId,
        is_active: true,
        approval_status: "approved",
        must_change_password: role === "admin",
      }, { onConflict: "id" });
      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
      if (role === "admin") {
        await sendLoginEmail({
          toEmail: email,
          fullName,
          temporaryPassword: password,
          roleLabel: "preschool administrator",
        });
      }
    }

    const now = new Date().toISOString();
    const assignment = role === "master_admin"
      ? { user_id: userId, role, status: "active", permissions, assigned_by: authorization.staff.userId, assigned_at: now, updated_at: now }
      : { user_id: userId, school_id: schoolId, role, status: "active", permissions, invited_by: authorization.staff.userId, invited_at: now, accepted_at: invited ? null : now, updated_at: now };
    const table = role === "master_admin" ? "platform_user_roles" : "school_memberships";
    const conflict = role === "master_admin" ? "user_id" : "user_id,school_id";
    const { error: assignmentError } = await supabaseAdmin.from(table).upsert(assignment, { onConflict: conflict });
    if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 400 });

    await writeSecurityAudit(authorization.staff, `${role}.invited`, {
      target_user_id: userId,
      target_email: email,
      target_role: role,
      school_id: role === "master_admin" ? null : schoolId,
      permissions,
    });
    return NextResponse.json({ success: true, invited, user_id: userId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create the role assignment." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const role = String(body.role || "").toLowerCase();
    const userId = String(body.user_id || "");
    const schoolId = Number(body.school_id || 0);
    const status = String(body.status || "active").toLowerCase();
    if (!isManagedRole(role) || !userId || !ACTIVE_STATUSES.has(status)) {
      return NextResponse.json({ error: "A valid assignment and status are required." }, { status: 400 });
    }
    const authorization = await authorizeRoleManagement(request, role, schoolId);
    if (!authorization.ok) return authorization.response;
    if (!canManageRole(authorization.staff.role, role)) {
      return NextResponse.json({ error: `You cannot manage ${managedRoleLabel(role)} accounts.` }, { status: 403 });
    }
    const permissions = validateManagedPermissions(role, body.permissions);
    const table = role === "master_admin" ? "platform_user_roles" : "school_memberships";
    let query = supabaseAdmin.from(table).update({ status, permissions, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("role", role);
    if (role !== "master_admin") query = query.eq("school_id", schoolId);
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await writeSecurityAudit(authorization.staff, `${role}.updated`, { target_user_id: userId, status, permissions });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update the assignment." }, { status: 400 });
  }
}
