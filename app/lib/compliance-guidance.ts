export type RequirementGuidance = {
  plain_language_description?: string | null; why_it_matters?: string | null;
  preparation_guidance?: string | null; authority_review_guidance?: string | null;
  owner_guidance?: string | null; applicability_guidance?: string | null;
  ready_definition?: string | null; next_action_guidance?: string | null;
  what_this_is?: string | null; what_to_prepare?: string | null;
  what_authority_may_ask_to_see?: string | null; source_title?: string | null;
};

export const READY_EXPLANATION = "Ready means this requirement has been prepared within DailyBloom for review. It does not mean it has been officially approved by DBE, DSD, a municipality or another authority.";

export function nextRequirementAction(status: string, verified: boolean, configured?: string | null) {
  if (configured) return configured;
  if (status === "Not Started") return "Start preparation";
  if (status === "In Progress") return "Continue preparation or link evidence";
  if (status === "Missing") return "Upload or link evidence";
  if (status === "Needs Review") return "Review evidence and recorded status";
  if (status === "Expired") return "Update or replace expired evidence";
  if (status === "Ready" && !verified) return "Review and verify";
  if (status === "Not Applicable") return "No action required";
  return "Monitor expiry and keep evidence current";
}

export function hasRequirementGuidance(item: RequirementGuidance) {
  return Boolean(item.plain_language_description || item.what_this_is || item.why_it_matters || item.preparation_guidance || item.what_to_prepare || item.authority_review_guidance || item.what_authority_may_ask_to_see || item.owner_guidance || item.applicability_guidance || item.ready_definition || item.next_action_guidance || item.source_title);
}
