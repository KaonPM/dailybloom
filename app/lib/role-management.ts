import {
  DelegatedRole,
  isDelegatedRole,
  Permission,
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
  const permissions = sanitizeDelegatedPermissions(role as DelegatedRole, values);
  if (permissions.length === 0) {
    throw new Error(`Select at least one permission for the ${managedRoleLabel(role)}.`);
  }
  return permissions;
}

export function canManageRole(actorRole: string, role: ManagedRole) {
  const actor = String(actorRole || "").toLowerCase();
  if (role === "master_admin" || role === "owner") return actor === "master";
  return actor === "owner" || actor === "principal" || actor === "master";
}
