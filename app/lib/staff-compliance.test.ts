import assert from "node:assert/strict";
import test from "node:test";
import { staffMatchesFilters, summarizeStaffCompliance } from "./staff-compliance";

test("staff summary places each item in exactly one state", () => {
  const summary = summarizeStaffCompliance([
    { status: "Not Started" }, { status: "In Progress" }, { status: "Ready", expiry_date: "2026-10-20" },
    { status: "Ready", expiry_date: "2026-09-20" }, { status: "Ready", expiry_date: "2026-09-07" },
    { status: "Needs Review" }, { status: "Not Applicable" },
  ], new Date("2026-09-08T10:00:00Z"));
  assert.deepEqual(summary, { missing: 1, inProgress: 1, ready: 1, needsReview: 1, expiringSoon: 1, expired: 1, notApplicable: 1 });
});

test("staff filters keep inactive staff optional and never need identifiers", () => {
  const staff = { full_name: "Amina Ndlovu", role: "teacher", active: false, summary: { missing: 1, inProgress: 0, ready: 0, needsReview: 0, expiringSoon: 0, expired: 0, notApplicable: 0 } };
  assert.equal(staffMatchesFilters(staff, { search: "amina", activity: "Inactive", state: "Missing" }), true);
  assert.equal(staffMatchesFilters(staff, { activity: "Active" }), false);
});
