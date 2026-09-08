import assert from "node:assert/strict";
import test from "node:test";
import { renewalDisplayStatus, renewalItem, sortRenewals, summarizeRenewals } from "./renewal-aggregation";

const now = new Date("2026-09-08T00:00:00Z");
const item = (source_id: string, expiry_date: string | null, renewal_status: string | null = null) => renewalItem({ source_type: "manual", source_id, school_id: 14, title: source_id, category: "Manual certificate", holder: "School", issue_date: null, expiry_date, renewal_status, verification_status: "Unverified", linked_document_id: null, source_route: "/dbe-registration/certificates", source_label: "Manual Certificate", is_manual: true }, now);

test("renewals classify expiry including the inclusive 30-day boundary", () => {
  assert.equal(item("expired", "2026-09-07").expiry_status, "Expired");
  assert.equal(item("soon", "2026-10-08").expiry_status, "Expiring Soon");
  assert.equal(item("current", "2026-10-09").expiry_status, "Current");
  assert.equal(item("none", null).expiry_status, "No Expiry");
});

test("renewal in progress supplements but never hides expiry", () => {
  assert.equal(renewalDisplayStatus(item("expired", "2026-09-07", "In Progress")), "Expired · Renewal In Progress");
  assert.equal(renewalDisplayStatus(item("current", "2026-10-09", "In Progress")), "Renewal In Progress");
});

test("renewal summary and sort prioritise attention", () => {
  const items = [item("none", null), item("current", "2026-10-09"), item("progress", "2026-12-01", "In Progress"), item("soon", "2026-09-12"), item("expired", "2026-09-07")];
  assert.deepEqual(summarizeRenewals(items), { total: 5, expiringSoon: 1, expired: 1, renewalInProgress: 1, current: 2, noExpiry: 1, attention: 2 });
  assert.deepEqual(sortRenewals(items).map((entry) => entry.title), ["expired", "soon", "progress", "current", "none"]);
});

test("renewal items keep an authoritative source route without exposing it in their display text", () => {
  const registration = renewalItem({ source_type: "registration", source_id: "registration-id", school_id: 14, title: "DBE Registration", category: "Registration", holder: "School", issue_date: null, expiry_date: "2026-10-01", renewal_status: null, verification_status: null, linked_document_id: null, source_route: "/dbe-registration", source_label: "Registration", is_manual: false }, now);
  assert.equal(registration.source_route, "/dbe-registration");
  assert.equal(registration.title.includes("registration-id"), false);
  assert.equal(registration.holder, "School");
});
