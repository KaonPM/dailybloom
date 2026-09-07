import assert from "node:assert/strict";
import test from "node:test";
import { calculateReadiness, classifyExpiry, correctiveActionState } from "./compliance";

test("readiness excludes not applicable and ineffective requirements", () => {
  const score = calculateReadiness([
    { status: "Ready" }, { status: "Not Applicable" }, { status: "Ready", active: false },
    { status: "In Progress", effective_from: "2099-01-01" },
  ], new Date("2026-09-08T00:00:00Z"));
  assert.deepEqual(score, { ready: 1, total: 1, percent: 100 });
});

test("expiry classification uses a shared 30-day threshold", () => {
  const now = new Date("2026-09-08T00:00:00Z");
  assert.equal(classifyExpiry(null, now), "No Expiry");
  assert.equal(classifyExpiry("2026-09-07", now), "Expired");
  assert.equal(classifyExpiry("2026-10-08", now), "Expiring Soon");
  assert.equal(classifyExpiry("2026-10-09", now), "Current");
});

test("overdue actions are calculated without changing their stored workflow", () => {
  assert.equal(correctiveActionState("Open", "2026-09-01", new Date("2026-09-08")), "Overdue");
  assert.equal(correctiveActionState("Closed", "2026-09-01", new Date("2026-09-08")), "Closed");
});
