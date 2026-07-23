import {
  isDelegatedRole,
  Permission,
  ROLE_PERMISSIONS,
  sanitizeDelegatedPermissions,
} from "./permissions";

export type SchoolMembership = {
  school_id: number | string;
  role?: string | null;
  permissions?: string[] | null;
};

export type SchoolAuthorization = {
  schoolId: number;
  role: string;
  permissions: string[];
};

export function effectivePermissions(role: string, additionalPermissions: readonly string[] = []) {
  const normalizedRole = String(role || "").toLowerCase();
  if (isDelegatedRole(normalizedRole) && additionalPermissions.length > 0) {
    return sanitizeDelegatedPermissions(normalizedRole, additionalPermissions);
  }
  return [...new Set([...(ROLE_PERMISSIONS[normalizedRole] || []), ...additionalPermissions])];
}

export function hasPermission(permissions: readonly string[], permission: Permission) {
  return permissions.includes(permission);
}

export function resolveSchoolAuthorization({
  requestedSchoolId,
  profileSchoolId,
  legacyRole,
  memberships,
}: {
  requestedSchoolId?: number | null;
  profileSchoolId?: number | null;
  legacyRole?: string | null;
  memberships: readonly SchoolMembership[];
}): SchoolAuthorization | null {
  const schoolId = Number(requestedSchoolId || profileSchoolId || 0);
  if (!schoolId) return null;

  const membership = memberships.find((item) => Number(item.school_id) === schoolId);
  const role = String(
    membership?.role || (Number(profileSchoolId) === schoolId ? legacyRole : "")
  ).toLowerCase();
  if (!role) return null;

  return {
    schoolId,
    role,
    permissions: effectivePermissions(role, membership?.permissions || []),
  };
}
