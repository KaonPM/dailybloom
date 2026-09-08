import assert from "node:assert/strict";
import test from "node:test";
import { nextRequirementAction, READY_EXPLANATION } from "./compliance-guidance";
import { complianceAuditPrefixesForModule, complianceAuditPresentation } from "./compliance-audit";

test("ready wording does not imply official approval", () => {
  assert.match(READY_EXPLANATION, /does not mean it has been officially approved/i);
  assert.equal(nextRequirementAction("Ready", false), "Review and verify");
  assert.equal(nextRequirementAction("Not Applicable", false), "No action required");
});

test("audit presentation exposes safe modules without raw audit details", () => {
  assert.deepEqual(complianceAuditPresentation("dbe.registration_saved"), { module: "Registration", label: "Registration saved" });
  assert.deepEqual(complianceAuditPresentation("compliance.corrective_action_closed"), { module: "Corrective Actions", label: "Corrective action updated" });
  assert.equal(complianceAuditPresentation("unrelated.event"), null);
});

test("audit modules expose their action prefixes for accurate pagination", () => {
  assert.deepEqual(complianceAuditPrefixesForModule("Registration"), ["dbe.registration_saved", "dbe.compliance_status_saved"]);
  assert.deepEqual(complianceAuditPrefixesForModule("Certificates & Renewals"), ["compliance.certificate"]);
});
