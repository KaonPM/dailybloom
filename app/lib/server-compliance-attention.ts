import "server-only";
import { buildComplianceAttention } from "./compliance-attention";
import { getSchoolCorrectiveActions } from "./server-corrective-actions";
import { getSchoolRenewals } from "./server-renewals";
import { supabaseAdmin } from "./supabase-admin";

export async function getSchoolComplianceAttention(schoolId: number, now = new Date()) {
  const [renewals, corrective, inspections, findings, requirements] = await Promise.all([
    getSchoolRenewals(schoolId), getSchoolCorrectiveActions(schoolId),
    supabaseAdmin.from("compliance_inspections").select("id, inspection_type, scheduled_date, status").eq("school_id", schoolId),
    supabaseAdmin.from("compliance_inspection_findings").select("id, description, status, corrective_action_required").eq("school_id", schoolId),
    supabaseAdmin.from("school_compliance_requirements").select("id, status, compliance_requirements(title, active, effective_from, effective_to)").eq("school_id", schoolId),
  ]);
  const failure = [inspections, findings, requirements].find((result) => result.error)?.error;
  if (failure) throw new Error(failure.message);
  return buildComplianceAttention({ schoolId, renewals: renewals.items, actions: corrective.items, inspections: inspections.data || [], findings: findings.data || [], requirements: requirements.data || [] }, now);
}
