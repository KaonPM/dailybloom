import { classifyExpiry } from "./compliance";
import { correctiveActionTiming, normalizeCorrectiveActionPriority } from "./corrective-actions";
import type { RenewalItem } from "./renewal-aggregation";

export type ComplianceAttentionSeverity = "critical" | "high" | "medium" | "low";
export type ComplianceAttentionItem = {
  key: string; school_id: number; type: string; severity: ComplianceAttentionSeverity;
  title: string; description: string; source: string; source_record: string | null;
  due_date: string | null; days_until_due: number | null; days_overdue: number | null;
  action_url: string; action_label: string; recipient_roles: string[]; actionable: true;
};

const DAY = 86_400_000;
const day = (value: string | null | undefined, now: Date) => value ? Math.floor((Date.parse(`${value}T00:00:00Z`) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / DAY) : null;
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
const recipients = ["owner", "principal", "admin"];

function expiryAttention(item: RenewalItem, now: Date): ComplianceAttentionItem | null {
  if (!["Expired", "Expiring Soon"].includes(item.expiry_status) || !item.expiry_date) return null;
  const remaining = day(item.expiry_date, now);
  const registration = item.source_type === "registration";
  const staff = item.source_type === "staff";
  const expired = item.expiry_status === "Expired";
  const kind = registration ? "DBE registration renewal" : staff ? "Staff compliance item" : item.title;
  return {
    key: `${registration ? "registration-renewal" : staff ? "staff-compliance-expiry" : "document-expiry"}:${item.source_id}`,
    school_id: item.school_id, type: registration ? "registration_renewal" : staff ? "staff_expiry" : "document_expiry",
    severity: registration && expired ? "critical" : expired ? "high" : "medium",
    title: expired ? `${kind} expired` : `${kind} expiring soon`,
    description: expired ? `Expired ${Math.abs(remaining || 0)} day${Math.abs(remaining || 0) === 1 ? "" : "s"} ago.` : `Expires in ${remaining || 0} day${remaining === 1 ? "" : "s"}.`,
    source: item.source_label, source_record: item.source_id, due_date: item.expiry_date,
    days_until_due: expired ? null : remaining, days_overdue: expired ? Math.abs(remaining || 0) : null,
    action_url: item.source_route, action_label: registration ? "Open Registration" : staff ? "Open Staff Compliance" : "Open Certificates", recipient_roles: recipients, actionable: true,
  };
}

export function buildComplianceAttention(input: {
  schoolId: number; renewals: RenewalItem[];
  actions: Array<{ id: string; title: string; status: string; priority: string; due_date: string | null }>;
  inspections: Array<{ id: string; inspection_type?: string | null; scheduled_date?: string | null; status?: string | null }>;
  findings: Array<{ id: string; description?: string | null; status?: string | null; corrective_action_required?: boolean | null }>;
  requirements: Array<{ id: string; status?: string | null; compliance_requirements?: { title?: string | null; active?: boolean | null; effective_from?: string | null; effective_to?: string | null } | Array<{ title?: string | null; active?: boolean | null; effective_from?: string | null; effective_to?: string | null }> | null }>;
}, now = new Date()): ComplianceAttentionItem[] {
  const items: ComplianceAttentionItem[] = input.renewals.map((item) => expiryAttention(item, now)).filter((item): item is ComplianceAttentionItem => Boolean(item));
  for (const action of input.actions) {
    if (action.status === "Closed") continue;
    const timing = correctiveActionTiming(action.status, action.due_date, now);
    const priority = normalizeCorrectiveActionPriority(action.priority);
    if (action.status === "Ready for Verification") items.push({ key: `corrective-action-verification:${action.id}`, school_id: input.schoolId, type: "corrective_action_verification", severity: "medium", title: "Corrective action ready for verification", description: action.title, source: "Corrective Actions", source_record: action.id, due_date: action.due_date, days_until_due: day(action.due_date, now), days_overdue: null, action_url: "/dbe-registration/corrective-actions", action_label: "Review Action", recipient_roles: recipients, actionable: true });
    else if (timing.overdue) items.push({ key: `corrective-action-due:${action.id}`, school_id: input.schoolId, type: "corrective_action_overdue", severity: priority === "Critical" ? "critical" : "high", title: "Corrective action overdue", description: `${action.title} · overdue by ${Math.abs(day(action.due_date, now) || 0)} days.`, source: "Corrective Actions", source_record: action.id, due_date: action.due_date, days_until_due: null, days_overdue: Math.abs(day(action.due_date, now) || 0), action_url: "/dbe-registration/corrective-actions", action_label: "Open Action", recipient_roles: recipients, actionable: true });
    else if (timing.dueSoon) items.push({ key: `corrective-action-due:${action.id}`, school_id: input.schoolId, type: "corrective_action_due", severity: priority === "High" || priority === "Critical" ? "high" : "medium", title: "Corrective action due soon", description: `${action.title} · due in ${day(action.due_date, now) || 0} days.`, source: "Corrective Actions", source_record: action.id, due_date: action.due_date, days_until_due: day(action.due_date, now), days_overdue: null, action_url: "/dbe-registration/corrective-actions", action_label: "Open Action", recipient_roles: recipients, actionable: true });
  }
  for (const inspection of input.inspections) {
    const remaining = day(inspection.scheduled_date, now); const status = String(inspection.status || "");
    if (remaining !== null && remaining >= 0 && remaining <= 7 && !["Closed", "Cancelled", "Completed"].includes(status)) items.push({ key: `inspection-upcoming:${inspection.id}`, school_id: input.schoolId, type: "inspection_upcoming", severity: "medium", title: "Inspection approaching", description: `${inspection.inspection_type || "Inspection"} · ${remaining === 0 ? "today" : `in ${remaining} days`}.`, source: "Inspections", source_record: inspection.id, due_date: inspection.scheduled_date || null, days_until_due: remaining, days_overdue: null, action_url: "/dbe-registration/inspections", action_label: "Open Inspections", recipient_roles: recipients, actionable: true });
  }
  const unresolved = input.findings.filter((finding) => finding.corrective_action_required && !["Closed", "Resolved"].includes(String(finding.status || "")));
  if (unresolved.length) items.push({ key: `inspection-findings:${input.schoolId}`, school_id: input.schoolId, type: "inspection_findings", severity: "medium", title: `${plural(unresolved.length, "inspection finding")} require action`, description: "Internal or external inspection findings remain unresolved.", source: "Inspections", source_record: null, due_date: null, days_until_due: null, days_overdue: null, action_url: "/dbe-registration/inspections", action_label: "Open Inspections", recipient_roles: recipients, actionable: true });
  const statuses = ["Missing", "Needs Review", "Expired"] as const;
  for (const status of statuses) {
    const count = input.requirements.filter((row) => { const relation = Array.isArray(row.compliance_requirements) ? row.compliance_requirements[0] : row.compliance_requirements; const today = now.toISOString().slice(0, 10); return row.status === status && relation?.active !== false && (!relation?.effective_from || relation.effective_from <= today) && (!relation?.effective_to || relation.effective_to >= today); }).length;
    if (count) items.push({ key: `requirement-status:${input.schoolId}:${status.toLowerCase().replace(/ /g, "-")}`, school_id: input.schoolId, type: "requirement_status", severity: status === "Expired" ? "high" : "medium", title: `${plural(count, "requirement")} ${status.toLowerCase()}`, description: "Review the recorded requirement status.", source: "Requirements", source_record: null, due_date: null, days_until_due: null, days_overdue: null, action_url: "/dbe-registration/requirements", action_label: "Open Requirements", recipient_roles: recipients, actionable: true });
  }
  const weight: Record<ComplianceAttentionSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...new Map(items.map((item) => [item.key, item])).values()].sort((a, b) => weight[a.severity] - weight[b.severity] || (a.due_date || "9999").localeCompare(b.due_date || "9999"));
}

export function priorityComplianceAttention(items: ComplianceAttentionItem[]) { return items.filter((item) => item.severity === "critical" || item.severity === "high" || item.type === "corrective_action_verification" || item.days_until_due === 0 || (item.days_until_due !== null && item.days_until_due <= 3)).slice(0, 3); }
