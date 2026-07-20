import "server-only";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "./supabase-admin";
import { Permission, ROLE_PERMISSIONS } from "./permissions";
import { effectivePermissions, hasPermission, resolveSchoolAuthorization } from "./authorization-policy";

type StaffProfile = {
  id: string;
  school_id?: number | null;
  role?: string | null;
  full_name?: string | null;
  email?: string | null;
  is_active?: boolean | null;
  classroom_name?: string | null;
};

type AuthorizedStaff = { userId: string; profile: StaffProfile; schoolId: number | null; role: string; permissions: string[]; isPlatformUser: boolean };
type AuthorizationResult = { ok: true; staff: AuthorizedStaff } | { ok: false; response: NextResponse };

function denied(message: string, status: number): AuthorizationResult {
  return { ok: false, response: NextResponse.json({ error: message }, { status }) };
}

export async function requireStaffPermission(request: Request, permission: Permission, requestedSchoolId?: number | null): Promise<AuthorizationResult> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return denied("Authentication required.", 401);
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) return denied("Invalid or expired session.", 401);

  const userId = userData.user.id;
  const [{ data: profile }, { data: platformRole }, { data: memberships }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, school_id, role, full_name, email, is_active, classroom_name").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("platform_user_roles").select("role, status, permissions").eq("user_id", userId).eq("status", "active").maybeSingle(),
    supabaseAdmin.from("school_memberships").select("school_id, role, status, permissions").eq("user_id", userId).eq("status", "active"),
  ]);
  if (!profile || profile.is_active === false) return denied("Active staff profile required.", 403);

  const platformRoleName = String(platformRole?.role || "").toLowerCase();
  if (platformRoleName) {
    const permissions = effectivePermissions(platformRoleName, platformRole?.permissions || []);
    if (!hasPermission(permissions, permission)) return denied("You do not have permission for this action.", 403);
    return { ok: true, staff: { userId, profile, schoolId: requestedSchoolId || null, role: platformRoleName, permissions, isPlatformUser: true } };
  }

  const legacyRole = String(profile.role || "").toLowerCase();
  if (legacyRole === "master") return { ok: true, staff: { userId, profile, schoolId: requestedSchoolId || null, role: legacyRole, permissions: [...ROLE_PERMISSIONS.master], isPlatformUser: true } };

  const schoolId = Number(requestedSchoolId || profile.school_id || 0);
  if (!schoolId) return denied("School context required.", 400);
  const schoolAuthorization = resolveSchoolAuthorization({ requestedSchoolId: schoolId, profileSchoolId: Number(profile.school_id || 0), legacyRole, memberships: memberships || [] });
  if (!schoolAuthorization) return denied("You do not belong to this school.", 403);
  if (!hasPermission(schoolAuthorization.permissions, permission)) return denied("You do not have permission for this action.", 403);
  return { ok: true, staff: { userId, profile, schoolId: schoolAuthorization.schoolId, role: schoolAuthorization.role, permissions: schoolAuthorization.permissions, isPlatformUser: false } };
}

export async function writeSecurityAudit(staff: AuthorizedStaff, action: string, details: Record<string, unknown> = {}) {
  await supabaseAdmin.from("security_audit_log").insert({ actor_id: staff.userId, actor_name: staff.profile.full_name || staff.profile.email, actor_role: staff.role, school_id: staff.schoolId, action, details });
}
