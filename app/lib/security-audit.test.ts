import assert from "node:assert/strict";
import test from "node:test";
import { persistSecurityAudit, type SecurityAuditEntry } from "./security-audit";

const entry: SecurityAuditEntry = {
  actor_id: "00000000-0000-0000-0000-000000000001",
  actor_name: "Test Principal",
  actor_role: "principal",
  school_id: 15,
  action: "dbe.registration_saved",
  target_type: "dbe_registration",
  target_id: "00000000-0000-0000-0000-000000000002",
  details: { registration_id: "00000000-0000-0000-0000-000000000002" },
};

test("persists the DBE registration audit event with safe target context", async () => {
  let received: SecurityAuditEntry | null = null;
  await persistSecurityAudit(entry, async (value) => {
    received = value;
    return { error: null };
  });

  assert.deepEqual(received, entry);
});

test("fails closed when security audit persistence is rejected", async () => {
  await assert.rejects(
    persistSecurityAudit(entry, async () => ({ error: { message: "insert denied" } })),
    /Security audit write failed: insert denied/
  );
});
