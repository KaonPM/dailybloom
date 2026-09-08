import assert from "node:assert/strict";
import test from "node:test";
import { buildComplianceAttention } from "./compliance-attention";
import { renewalItem } from "./renewal-aggregation";

const now = new Date("2026-09-08T10:00:00Z");
const renewal = (source_type: "registration" | "document" | "staff", source_id: string, expiry_date: string) => renewalItem({ source_type, source_id, school_id: 14, title: source_type === "staff" ? "First Aid" : "Health Certificate", category: "Test", holder: "School", issue_date: null, expiry_date, renewal_status: null, verification_status: null, linked_document_id: null, source_route: "/dbe-registration/certificates", source_label: "Certificates", is_manual: false }, now);
const base = (overrides = {}) => buildComplianceAttention({ schoolId: 14, renewals: [], actions: [], inspections: [], findings: [], requirements: [], ...overrides }, now);

test("attention honours expiry and corrective-action inclusive boundaries", () => {
  const items = base({ renewals: [renewal("registration", "r", "2026-10-08"), renewal("document", "d", "2026-09-07")], actions: [{ id: "a", title: "Exit sign", status: "Open", priority: "High", due_date: "2026-09-15" }] });
  assert.equal(items.some((item) => item.key === "registration-renewal:r" && item.severity === "medium"), true);
  assert.equal(items.some((item) => item.key === "document-expiry:d" && item.severity === "high"), true);
  assert.equal(items.some((item) => item.key === "corrective-action-due:a"), true);
});

test("attention excludes closed actions and inactive or not-applicable requirements", () => {
  const items = base({ actions: [{ id: "closed", title: "Closed", status: "Closed", priority: "Critical", due_date: "2026-09-01" }], requirements: [
    { id: "inactive", status: "Missing", compliance_requirements: { active: false } },
    { id: "na", status: "Not Applicable", compliance_requirements: { active: true } },
    { id: "ready", status: "Ready", compliance_requirements: { active: true } },
  ] });
  assert.equal(items.length, 0);
});

test("attention aggregates requirements and de-duplicates underlying renewal sources", () => {
  const items = base({ renewals: [renewal("staff", "staff-1", "2026-09-18"), renewal("staff", "staff-1", "2026-09-18")], requirements: [
    { id: "one", status: "Missing", compliance_requirements: { active: true } }, { id: "two", status: "Missing", compliance_requirements: { active: true } },
  ] });
  assert.equal(items.filter((item) => item.key === "staff-compliance-expiry:staff-1").length, 1);
  assert.equal(items.some((item) => item.key === "requirement-status:14:missing" && item.title.startsWith("2 requirements")), true);
});
