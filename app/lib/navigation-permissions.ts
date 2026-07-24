import { Permission, PERMISSIONS } from "./permissions";

const SCHOOL_ROUTE_PERMISSIONS: readonly [string, Permission][] = [
  ["/dbe-registration", PERMISSIONS.DBE_MANAGE],
  ["/teacher-attendance", PERMISSIONS.TEACHER_ATTENDANCE_MANAGE],
  ["/classroom-activities", PERMISSIONS.ACTIVITIES_MANAGE],
  ["/learner-requirements", PERMISSIONS.REQUIREMENTS_VIEW],
  ["/progress-reports", PERMISSIONS.PROGRESS_REPORTS_MANAGE],
  ["/achievement-awards", PERMISSIONS.AWARDS_MANAGE],
  ["/school-documents", PERMISSIONS.SCHOOL_DOCUMENTS_MANAGE],
  ["/incident-reports", PERMISSIONS.INCIDENT_REVIEW],
  ["/communications", PERMISSIONS.COMMUNICATIONS_MANAGE],
  ["/broadcasts", PERMISSIONS.BROADCASTS_MANAGE],
  ["/classrooms", PERMISSIONS.CLASSROOM_ASSIGN],
  ["/attendance", PERMISSIONS.ATTENDANCE_MANAGE],
  ["/summaries", PERMISSIONS.SUMMARIES_MANAGE],
  ["/analytics", PERMISSIONS.ANALYTICS_VIEW],
  ["/reports", PERMISSIONS.REPORTS_VIEW],
  ["/payments", PERMISSIONS.BILLING_MANAGE],
  ["/billing", PERMISSIONS.BILLING_MANAGE],
  ["/teachers", PERMISSIONS.STAFF_VIEW],
  ["/children", PERMISSIONS.LEARNERS_MANAGE],
  ["/events", PERMISSIONS.EVENTS_MANAGE],
  ["/messages", PERMISSIONS.MESSAGE_VIEW],
];

export function permissionForSchoolPath(pathname: string): Permission | null {
  return (
    SCHOOL_ROUTE_PERMISSIONS.find(
      ([route]) => pathname === route || pathname.startsWith(`${route}/`)
    )?.[1] || null
  );
}
