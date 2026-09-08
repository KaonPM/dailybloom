import "server-only";
import { correctiveActionTiming, normalizeCorrectiveActionPriority, sortCorrectiveActions, summarizeCorrectiveActions } from "./corrective-actions";
import { supabaseAdmin } from "./supabase-admin";

type Row = Record<string, unknown>;
type DirectoryEntry = { id: string; name: string; role: string; active: boolean };

const sourceLabels: Record<string, string> = {
  inspection_finding: "Inspection Finding",
  requirement: "Requirement",
  manual: "Manual",
};

export async function correctiveActionDirectory(schoolId: number): Promise<DirectoryEntry[]> {
  const [{ data: memberships, error: membershipError }, { data: legacy, error: legacyError }] = await Promise.all([
    supabaseAdmin.from("school_memberships").select("user_id, role, status").eq("school_id", schoolId),
    supabaseAdmin.from("profiles").select("id, full_name, role, is_active").eq("school_id", schoolId),
  ]);
  if (membershipError || legacyError) throw new Error(membershipError?.message || legacyError?.message || "Staff directory could not be loaded.");
  const membershipIds = [...new Set((memberships || []).map((item) => String(item.user_id)))];
  const { data: membershipProfiles, error: profileError } = membershipIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name, is_active").in("id", membershipIds)
    : { data: [], error: null };
  if (profileError) throw new Error(profileError.message);
  const profiles = new Map([...(legacy || []), ...(membershipProfiles || [])].map((item) => [String(item.id), item]));
  const result = new Map<string, DirectoryEntry>();
  for (const membership of memberships || []) {
    const profile = profiles.get(String(membership.user_id));
    if (!profile) continue;
    result.set(String(membership.user_id), { id: String(membership.user_id), name: String(profile.full_name || "Staff member"), role: String(membership.role || "staff"), active: membership.status === "active" && profile.is_active !== false });
  }
  for (const profile of legacy || []) if (!result.has(String(profile.id))) result.set(String(profile.id), { id: String(profile.id), name: String(profile.full_name || "Staff member"), role: String(profile.role || "staff"), active: profile.is_active !== false });
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSchoolCorrectiveActions(schoolId: number) {
  const [actionsResult, evidenceResult, documentsResult, findingsResult, requirementsResult, inspectionsResult, directory] = await Promise.all([
    supabaseAdmin.from("compliance_corrective_actions").select("*").eq("school_id", schoolId),
    supabaseAdmin.from("compliance_corrective_action_evidence").select("id, corrective_action_id, document_id, linked_at").eq("school_id", schoolId),
    supabaseAdmin.from("dbe_compliance_documents").select("id, document_name, document_type, expiry_date, verification_status").eq("school_id", schoolId),
    supabaseAdmin.from("compliance_inspection_findings").select("id, inspection_id, category, description, priority, status").eq("school_id", schoolId),
    supabaseAdmin.from("school_compliance_requirements").select("id, status, compliance_requirements(title, requirement_group)").eq("school_id", schoolId),
    supabaseAdmin.from("compliance_inspections").select("id, inspection_type, inspection_date, scheduled_date").eq("school_id", schoolId),
    correctiveActionDirectory(schoolId),
  ]);
  const error = [actionsResult, evidenceResult, documentsResult, findingsResult, requirementsResult, inspectionsResult].find((result) => result.error)?.error;
  if (error) throw new Error(error.message);
  const staff = new Map(directory.map((item) => [item.id, item]));
  const docs = new Map((documentsResult.data || []).map((item) => [String(item.id), item]));
  const findings = new Map((findingsResult.data || []).map((item) => [String(item.id), item]));
  const requirements = new Map((requirementsResult.data || []).map((item) => [String(item.id), item]));
  const inspections = new Map((inspectionsResult.data || []).map((item) => [String(item.id), item]));
  const evidenceByAction = new Map<string, Row[]>();
  for (const link of evidenceResult.data || []) {
    const actionId = String(link.corrective_action_id); const document = docs.get(String(link.document_id));
    if (!document) continue;
    evidenceByAction.set(actionId, [...(evidenceByAction.get(actionId) || []), { id: link.id, linked_at: link.linked_at, document_id: link.document_id, document_name: document.document_name, document_type: document.document_type, verification_status: document.verification_status }]);
  }
  const rows = (actionsResult.data || []).map((action) => {
    const sourceType = String(action.source_type || "manual"); const sourceId = String(action.source_id || ""); const finding = sourceType === "inspection_finding" ? findings.get(sourceId) : undefined; const requirement = sourceType === "requirement" ? requirements.get(sourceId) : undefined;
    const inspection = finding ? inspections.get(String(finding.inspection_id)) : undefined;
    const requirementRelation = requirement?.compliance_requirements as unknown; const requirementInfo = Array.isArray(requirementRelation) ? requirementRelation[0] as Row | undefined : requirementRelation as Row | null | undefined;
    const sourceContext = finding ? `Inspection: ${String(inspection?.inspection_type || "Recorded inspection")} · Finding: ${String(finding.description || finding.category || "Finding")}` : requirement ? `Requirement: ${String(requirementInfo?.title || "Compliance requirement")}` : "Created manually";
    const responsible = staff.get(String(action.responsible_user_id || "")); const historicalAssignee = action.responsible_user_id && !responsible;
    const timing = correctiveActionTiming(action.status, action.due_date ? String(action.due_date) : null);
    return { ...action, priority: normalizeCorrectiveActionPriority(action.priority), source_label: sourceLabels[sourceType] || "Manual", source_context: sourceContext, responsible_name: responsible?.name || (historicalAssignee ? "Former staff member" : "Unassigned"), responsible_role: responsible?.role || null, responsible_active: responsible?.active ?? false, overdue: timing.overdue, due_soon: timing.dueSoon, evidence: evidenceByAction.get(String(action.id)) || [] };
  });
  return { items: sortCorrectiveActions(rows), summary: summarizeCorrectiveActions(rows), staff: directory, documents: documentsResult.data || [] };
}
