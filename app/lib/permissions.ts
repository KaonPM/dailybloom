export const PERMISSIONS = {
  STAFF_VIEW: "staff.view",
  STAFF_MANAGE: "staff.manage",
  CLASSROOM_ASSIGN: "classrooms.assign_staff",
  SCHOOL_MANAGE: "school.manage",
  SCHOOL_ONBOARD: "platform.schools.onboard",
  SCHOOL_STATUS: "platform.schools.status",
  PRINCIPAL_MANAGE: "platform.principals.manage",
  MESSAGE_SEND: "messages.send",
  MESSAGE_VIEW: "messages.view",
  PARENT_NOTIFY: "parents.notify",
  PARENT_ACCESS_MANAGE: "parents.access.manage",
  REQUIREMENTS_VIEW: "requirements.view",
  REQUIREMENTS_TRACK: "requirements.track",
  REQUIREMENTS_MANAGE: "requirements.manage",
  INCIDENT_REVIEW: "incidents.review",
  SAFEGUARDING_VIEW: "incidents.safeguarding_view",
  BILLING_MANAGE: "billing.manage",
  PLATFORM_ADMIN_MANAGE: "platform.admins.manage",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export type PermissionOption = {
  permission: Permission;
  label: string;
  description: string;
  group: "School operations" | "Communication" | "Learners" | "Platform";
};

export const PERMISSION_OPTIONS: readonly PermissionOption[] = [
  { permission: PERMISSIONS.STAFF_VIEW, label: "View staff", description: "View staff members and their assigned roles.", group: "School operations" },
  { permission: PERMISSIONS.STAFF_MANAGE, label: "Manage staff", description: "Invite, update and deactivate school staff.", group: "School operations" },
  { permission: PERMISSIONS.CLASSROOM_ASSIGN, label: "Assign classrooms", description: "Assign practitioners to classrooms.", group: "School operations" },
  { permission: PERMISSIONS.SCHOOL_MANAGE, label: "Manage school", description: "Update school settings and operational information.", group: "School operations" },
  { permission: PERMISSIONS.MESSAGE_SEND, label: "Send messages", description: "Send school or parent communication.", group: "Communication" },
  { permission: PERMISSIONS.MESSAGE_VIEW, label: "View messages", description: "View messages available to the assigned school or platform role.", group: "Communication" },
  { permission: PERMISSIONS.PARENT_NOTIFY, label: "Notify parents", description: "Send parent notifications for supported workflows.", group: "Communication" },
  { permission: PERMISSIONS.PARENT_ACCESS_MANAGE, label: "Manage parent access", description: "Create, resend and reset parent portal access.", group: "Learners" },
  { permission: PERMISSIONS.REQUIREMENTS_VIEW, label: "View requirements", description: "View learner requirements and outstanding items.", group: "Learners" },
  { permission: PERMISSIONS.REQUIREMENTS_TRACK, label: "Record requirements", description: "Record stationery, hygiene and document progress.", group: "Learners" },
  { permission: PERMISSIONS.REQUIREMENTS_MANAGE, label: "Manage requirement lists", description: "Add, archive and configure required items.", group: "Learners" },
  { permission: PERMISSIONS.INCIDENT_REVIEW, label: "Review incidents", description: "Review and resolve incident reports.", group: "Learners" },
  { permission: PERMISSIONS.SAFEGUARDING_VIEW, label: "View safeguarding details", description: "View sensitive safeguarding information.", group: "Learners" },
  { permission: PERMISSIONS.BILLING_MANAGE, label: "Manage billing", description: "Manage subscription and billing information.", group: "School operations" },
  { permission: PERMISSIONS.SCHOOL_ONBOARD, label: "Onboard schools", description: "Review and create preschool accounts.", group: "Platform" },
  { permission: PERMISSIONS.SCHOOL_STATUS, label: "Manage school status", description: "Activate, suspend or restore preschool access.", group: "Platform" },
  { permission: PERMISSIONS.PRINCIPAL_MANAGE, label: "Manage principals", description: "Invite and manage preschool principals and owners.", group: "Platform" },
  { permission: PERMISSIONS.PLATFORM_ADMIN_MANAGE, label: "Manage platform administrators", description: "Invite and manage delegated Master Admin accounts.", group: "Platform" },
];

export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  master: Object.values(PERMISSIONS),
  master_admin: [PERMISSIONS.SCHOOL_ONBOARD, PERMISSIONS.SCHOOL_STATUS, PERMISSIONS.PRINCIPAL_MANAGE, PERMISSIONS.BILLING_MANAGE],
  owner: [PERMISSIONS.STAFF_VIEW, PERMISSIONS.STAFF_MANAGE, PERMISSIONS.CLASSROOM_ASSIGN, PERMISSIONS.SCHOOL_MANAGE, PERMISSIONS.MESSAGE_SEND, PERMISSIONS.MESSAGE_VIEW, PERMISSIONS.PARENT_NOTIFY, PERMISSIONS.PARENT_ACCESS_MANAGE, PERMISSIONS.REQUIREMENTS_VIEW, PERMISSIONS.REQUIREMENTS_TRACK, PERMISSIONS.REQUIREMENTS_MANAGE, PERMISSIONS.INCIDENT_REVIEW, PERMISSIONS.BILLING_MANAGE],
  principal: [PERMISSIONS.STAFF_VIEW, PERMISSIONS.STAFF_MANAGE, PERMISSIONS.CLASSROOM_ASSIGN, PERMISSIONS.SCHOOL_MANAGE, PERMISSIONS.MESSAGE_SEND, PERMISSIONS.MESSAGE_VIEW, PERMISSIONS.PARENT_NOTIFY, PERMISSIONS.PARENT_ACCESS_MANAGE, PERMISSIONS.REQUIREMENTS_VIEW, PERMISSIONS.REQUIREMENTS_TRACK, PERMISSIONS.REQUIREMENTS_MANAGE, PERMISSIONS.INCIDENT_REVIEW, PERMISSIONS.SAFEGUARDING_VIEW, PERMISSIONS.BILLING_MANAGE],
  admin: [PERMISSIONS.STAFF_VIEW, PERMISSIONS.CLASSROOM_ASSIGN, PERMISSIONS.MESSAGE_SEND, PERMISSIONS.MESSAGE_VIEW, PERMISSIONS.PARENT_NOTIFY, PERMISSIONS.PARENT_ACCESS_MANAGE, PERMISSIONS.REQUIREMENTS_VIEW, PERMISSIONS.REQUIREMENTS_TRACK, PERMISSIONS.REQUIREMENTS_MANAGE],
  teacher: [PERMISSIONS.MESSAGE_SEND, PERMISSIONS.MESSAGE_VIEW, PERMISSIONS.PARENT_NOTIFY, PERMISSIONS.REQUIREMENTS_VIEW, PERMISSIONS.REQUIREMENTS_TRACK],
};

export const DELEGATED_ROLES = ["admin", "master_admin"] as const;
export type DelegatedRole = typeof DELEGATED_ROLES[number];

export function isDelegatedRole(role: string): role is DelegatedRole {
  return DELEGATED_ROLES.includes(role as DelegatedRole);
}

export function selectablePermissionsForRole(role: DelegatedRole): readonly PermissionOption[] {
  const allowed = new Set(ROLE_PERMISSIONS[role] || []);
  return PERMISSION_OPTIONS.filter((option) => allowed.has(option.permission));
}

export function sanitizeDelegatedPermissions(
  role: DelegatedRole,
  requested: readonly string[]
): Permission[] {
  const allowed = new Set(ROLE_PERMISSIONS[role] || []);
  return [...new Set(requested)].filter((permission): permission is Permission =>
    allowed.has(permission as Permission)
  );
}
