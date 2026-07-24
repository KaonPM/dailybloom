export const PERMISSIONS = {
  STAFF_VIEW: "staff.view",
  STAFF_MANAGE: "staff.manage",
  CLASSROOM_ASSIGN: "classrooms.assign_staff",
  SCHOOL_MANAGE: "school.manage",
  LEARNERS_MANAGE: "learners.manage",
  ATTENDANCE_MANAGE: "attendance.manage",
  TEACHER_ATTENDANCE_MANAGE: "teacher_attendance.manage",
  ACTIVITIES_MANAGE: "activities.manage",
  EVENTS_MANAGE: "events.manage",
  SUMMARIES_MANAGE: "summaries.manage",
  BROADCASTS_MANAGE: "broadcasts.manage",
  PROGRESS_REPORTS_MANAGE: "progress_reports.manage",
  AWARDS_MANAGE: "awards.manage",
  COMMUNICATIONS_MANAGE: "communications.manage",
  REPORTS_VIEW: "reports.view",
  ANALYTICS_VIEW: "analytics.view",
  SCHOOL_DOCUMENTS_MANAGE: "school_documents.manage",
  DBE_MANAGE: "dbe.manage",
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
  PLATFORM_DASHBOARD_VIEW: "platform.dashboard.view",
  PLATFORM_REPORTS_VIEW: "platform.reports.view",
  PLATFORM_ANALYTICS_VIEW: "platform.analytics.view",
  PLATFORM_IMPACT_VIEW: "platform.impact.view",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export type PermissionOption = {
  permission: Permission;
  label: string;
  description: string;
  group: "Staff" | "Learners" | "Daily operations" | "Communication" | "Reports & documents" | "Sensitive access" | "Platform";
};

export const PERMISSION_OPTIONS: readonly PermissionOption[] = [
  { permission: PERMISSIONS.STAFF_VIEW, label: "View teachers and staff", description: "View staff members and their assigned roles.", group: "Staff" },
  { permission: PERMISSIONS.STAFF_MANAGE, label: "Manage teachers and staff", description: "Invite, update and deactivate school staff.", group: "Staff" },
  { permission: PERMISSIONS.CLASSROOM_ASSIGN, label: "Manage classrooms", description: "Create classrooms and assign practitioners.", group: "Staff" },
  { permission: PERMISSIONS.SCHOOL_MANAGE, label: "Manage school details", description: "Update school settings and operational information.", group: "Staff" },
  { permission: PERMISSIONS.LEARNERS_MANAGE, label: "Manage learners", description: "Add, view and update learner records.", group: "Learners" },
  { permission: PERMISSIONS.ATTENDANCE_MANAGE, label: "Learner attendance", description: "Capture and review learner attendance.", group: "Daily operations" },
  { permission: PERMISSIONS.TEACHER_ATTENDANCE_MANAGE, label: "Teacher attendance", description: "Capture and review teacher attendance.", group: "Daily operations" },
  { permission: PERMISSIONS.ACTIVITIES_MANAGE, label: "Classroom activities", description: "Plan and review classroom activities.", group: "Daily operations" },
  { permission: PERMISSIONS.EVENTS_MANAGE, label: "Events", description: "Create and manage school events.", group: "Daily operations" },
  { permission: PERMISSIONS.SUMMARIES_MANAGE, label: "Daily summaries", description: "Create and review learner daily summaries.", group: "Daily operations" },
  { permission: PERMISSIONS.PROGRESS_REPORTS_MANAGE, label: "Progress reports", description: "Prepare and review learner progress reports.", group: "Learners" },
  { permission: PERMISSIONS.AWARDS_MANAGE, label: "Achievement awards", description: "Nominate, issue and manage achievement awards.", group: "Learners" },
  { permission: PERMISSIONS.MESSAGE_SEND, label: "Send messages", description: "Send school or parent communication.", group: "Communication" },
  { permission: PERMISSIONS.MESSAGE_VIEW, label: "View messages", description: "View messages available to the assigned school or platform role.", group: "Communication" },
  { permission: PERMISSIONS.BROADCASTS_MANAGE, label: "Broadcasts", description: "Create and manage school broadcasts.", group: "Communication" },
  { permission: PERMISSIONS.COMMUNICATIONS_MANAGE, label: "Communication centre", description: "Access the school communication centre.", group: "Communication" },
  { permission: PERMISSIONS.PARENT_NOTIFY, label: "Notify parents", description: "Send parent notifications for supported workflows.", group: "Communication" },
  { permission: PERMISSIONS.PARENT_ACCESS_MANAGE, label: "Manage parent access", description: "Create, resend and reset parent portal access.", group: "Learners" },
  { permission: PERMISSIONS.REQUIREMENTS_VIEW, label: "View requirements", description: "View learner requirements and outstanding items.", group: "Learners" },
  { permission: PERMISSIONS.REQUIREMENTS_TRACK, label: "Record requirements", description: "Record stationery, hygiene and document progress.", group: "Learners" },
  { permission: PERMISSIONS.REQUIREMENTS_MANAGE, label: "Manage requirement lists", description: "Add, archive and configure required items.", group: "Learners" },
  { permission: PERMISSIONS.REPORTS_VIEW, label: "School reports", description: "View and generate school reports.", group: "Reports & documents" },
  { permission: PERMISSIONS.ANALYTICS_VIEW, label: "School analytics", description: "View school performance and operational analytics.", group: "Reports & documents" },
  { permission: PERMISSIONS.SCHOOL_DOCUMENTS_MANAGE, label: "Printable documents", description: "Access and manage school printable documents.", group: "Reports & documents" },
  { permission: PERMISSIONS.DBE_MANAGE, label: "DBE registration information", description: "Access DBE registration and compliance records.", group: "Reports & documents" },
  { permission: PERMISSIONS.INCIDENT_REVIEW, label: "Incident reports", description: "Review and resolve incident reports.", group: "Sensitive access" },
  { permission: PERMISSIONS.SAFEGUARDING_VIEW, label: "Safeguarding details", description: "View sensitive safeguarding information.", group: "Sensitive access" },
  { permission: PERMISSIONS.BILLING_MANAGE, label: "Payments and billing", description: "Manage learner payments, subscriptions and billing information.", group: "Sensitive access" },
  { permission: PERMISSIONS.SCHOOL_ONBOARD, label: "Onboard schools", description: "Review and create preschool accounts.", group: "Platform" },
  { permission: PERMISSIONS.SCHOOL_STATUS, label: "Manage school status", description: "Activate, suspend or restore preschool access.", group: "Platform" },
  { permission: PERMISSIONS.PRINCIPAL_MANAGE, label: "Manage principals", description: "Invite and manage preschool principals and owners.", group: "Platform" },
  { permission: PERMISSIONS.PLATFORM_ADMIN_MANAGE, label: "Manage platform administrators", description: "Invite and manage delegated Master Admin accounts.", group: "Platform" },
  { permission: PERMISSIONS.PLATFORM_DASHBOARD_VIEW, label: "Platform dashboard", description: "View the Master dashboard and preschool overview.", group: "Platform" },
  { permission: PERMISSIONS.PLATFORM_REPORTS_VIEW, label: "Platform reports", description: "Generate and review cross-school platform reports.", group: "Platform" },
  { permission: PERMISSIONS.PLATFORM_ANALYTICS_VIEW, label: "Platform analytics", description: "View cross-school operational analytics.", group: "Platform" },
  { permission: PERMISSIONS.PLATFORM_IMPACT_VIEW, label: "Impact and sponsorship", description: "View platform impact and sponsorship information.", group: "Platform" },
];

export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  master: Object.values(PERMISSIONS),
  master_admin: Object.values(PERMISSIONS),
  owner: Object.values(PERMISSIONS).filter((permission) => !permission.startsWith("platform.")),
  principal: Object.values(PERMISSIONS).filter((permission) => !permission.startsWith("platform.")),
  admin: Object.values(PERMISSIONS).filter((permission) => !permission.startsWith("platform.")),
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
