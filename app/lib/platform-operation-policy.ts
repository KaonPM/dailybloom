import { PERMISSIONS, type Permission } from "./permissions";

export const PLATFORM_OPERATION_PERMISSIONS = {
  set_school_active: PERMISSIONS.SCHOOL_STATUS,
  activate_school: PERMISSIONS.SCHOOL_STATUS,
  remove_principal: PERMISSIONS.PRINCIPAL_MANAGE,
  save_onboarding: PERMISSIONS.SCHOOL_ONBOARD,
  save_subscription: PERMISSIONS.BILLING_MANAGE,
  record_payment: PERMISSIONS.BILLING_MANAGE,
  mark_overdue: PERMISSIONS.BILLING_MANAGE,
} as const satisfies Record<string, Permission>;

export type PlatformOperation = keyof typeof PLATFORM_OPERATION_PERMISSIONS;

export function platformOperationPermission(action: string): Permission | null {
  return PLATFORM_OPERATION_PERMISSIONS[action as PlatformOperation] || null;
}
