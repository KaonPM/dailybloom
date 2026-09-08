export type ComplianceAuditModule = "Registration" | "Requirements" | "Documents & Evidence" | "Staff Compliance" | "Inspections" | "Corrective Actions" | "Certificates & Renewals";

const definitions: Array<[string, ComplianceAuditModule, string]> = [
  ["dbe.registration_saved", "Registration", "Registration saved"], ["dbe.compliance_status_saved", "Registration", "Premises summary saved"],
  ["compliance.requirement", "Requirements", "Requirement updated"], ["compliance.evidence", "Requirements", "Evidence link updated"],
  ["dbe.compliance_document", "Documents & Evidence", "Compliance document updated"], ["compliance.document", "Documents & Evidence", "Document details updated"],
  ["compliance.staff", "Staff Compliance", "Staff compliance updated"], ["compliance.inspection", "Inspections", "Inspection updated"], ["compliance.finding", "Inspections", "Inspection finding recorded"],
  ["compliance.corrective_action", "Corrective Actions", "Corrective action updated"], ["compliance.certificate", "Certificates & Renewals", "Certificate updated"],
];

export function complianceAuditPresentation(action: string) {
  const found = definitions.find(([prefix]) => action.startsWith(prefix));
  return found ? { module: found[1], label: found[2] } : null;
}

export function complianceAuditPrefixesForModule(module: ComplianceAuditModule) {
  return definitions
    .filter(([, definitionModule]) => definitionModule === module)
    .map(([prefix]) => prefix);
}
