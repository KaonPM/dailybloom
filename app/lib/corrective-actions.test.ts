import assert from "node:assert/strict";
import test from "node:test";
import { correctiveActionTiming, isCorrectiveActionTransition, sortCorrectiveActions, summarizeCorrectiveActions } from "./corrective-actions";

const now = new Date("2026-09-08T10:00:00Z");

test("corrective actions allow only controlled lifecycle transitions", () => {
  assert.equal(isCorrectiveActionTransition("Open", "In Progress"), true);
  assert.equal(isCorrectiveActionTransition("In Progress", "Ready for Verification"), true);
  assert.equal(isCorrectiveActionTransition("Ready for Verification", "Closed"), true);
  assert.equal(isCorrectiveActionTransition("Ready for Verification", "In Progress"), true);
  assert.equal(isCorrectiveActionTransition("Closed", "Reopened"), true);
  assert.equal(isCorrectiveActionTransition("Open", "Closed"), false);
  assert.equal(isCorrectiveActionTransition("Reopened", "Ready for Verification"), false);
});

test("overdue and due soon are derived with a seven-day inclusive window", () => {
  assert.deepEqual(correctiveActionTiming("In Progress", "2026-09-07", now), { overdue: true, dueSoon: false });
  assert.deepEqual(correctiveActionTiming("In Progress", "2026-09-15", now), { overdue: false, dueSoon: true });
  assert.deepEqual(correctiveActionTiming("In Progress", "2026-09-16", now), { overdue: false, dueSoon: false });
  assert.deepEqual(correctiveActionTiming("Closed", "2026-09-07", now), { overdue: false, dueSoon: false });
});

test("sorting prioritises critical overdue work and preserves closed history last", () => {
  const sorted = sortCorrectiveActions([
    { id: "closed", status: "Closed", priority: "Critical", due_date: "2026-09-01" },
    { id: "ready", status: "Ready for Verification", priority: "Low", due_date: "2026-10-01" },
    { id: "high-overdue", status: "In Progress", priority: "High", due_date: "2026-09-01" },
    { id: "critical-overdue", status: "Open", priority: "Critical", due_date: "2026-09-02" },
  ], now);
  assert.deepEqual(sorted.map((item) => item.id), ["critical-overdue", "high-overdue", "ready", "closed"]);
});

test("summary keeps reopened active and overdue separate from lifecycle status", () => {
  const summary = summarizeCorrectiveActions([
    { id: "a", status: "Open", priority: "Medium", due_date: "2026-09-01" },
    { id: "b", status: "Reopened", priority: "Medium", due_date: "2026-09-10" },
    { id: "c", status: "Ready for Verification", priority: "Medium", due_date: null },
    { id: "d", status: "Closed", priority: "Medium", due_date: "2026-09-01" },
  ], now);
  assert.deepEqual(summary, { open: 1, inProgress: 1, readyForVerification: 1, closed: 1, overdue: 1, dueSoon: 1, active: 3 });
});
