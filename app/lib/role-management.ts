import {
  DelegatedRole,
  isDelegatedRole,
  Permission,
  PERMISSIONS,
  sanitizeDelegatedPermissions,
} from "./permissions";

export const MANAGED_ROLES = ["owner", "admin", "master_admin"] as const;
export type ManagedRole = typeof MANAGED_ROLES[number];

export function isManagedRole(value: string): value is ManagedRole {
  return MANAGED_ROLES.includes(value as ManagedRole);
}

export function managedRoleLabel(role: ManagedRole) {
  if (role === "master_admin") return "Master Admin";
  if (role === "admin") return "Preschool Admin";
  return "Owner";
}

export function validateManagedPermissions(role: ManagedRole, requested: unknown) {
  if (!isDelegatedRole(role)) return [] as Permission[];
  const values = Array.isArray(requested)
    ? requested.filter((value): value is string => typeof value === "string")
    : [];
  const permissions = expandDelegatedPermissions(role as DelegatedRole, values);
  if (permissions.length === 0) {
    throw new Error(`Select at least one permission for the ${managedRoleLabel(role)}.`);
  }
  return permissions;
}

/**
 * A delegated admin must receive the access needed to reach a function they
 * have been granted. For example, practitioner management is only useful when
 * the practitioner list is visible as well.
 */
export function expandDelegatedPermissions(role: DelegatedRole, requested: readonly string[]): Permission[] {
  const permissions = new Set(sanitizeDelegatedPermissions(role, requested));
  if (role === "admin" && (permissions.has(PERMISSIONS.STAFF_MANAGE) || permissions.has(PERMISSIONS.CLASSROOM_ASSIGN))) {
    permissions.add(PERMISSIONS.STAFF_VIEW);
  }
  return [...permissions];
}

export function canManageRole(actorRole: string, role: ManagedRole) {
  const actor = String(actorRole || "").toLowerCase();
  if (role === "master_admin" || role === "owner") {
    return actor === "master" || actor === "master_admin";
  }
  return actor === "owner" || actor === "principal" || actor === "master";
}
