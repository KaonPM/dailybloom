import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSIONS } from "./permissions";
import { platformOperationPermission } from "./platform-operation-policy";

test("school status operations require school status permission", () => {
  assert.equal(platformOperationPermission("set_school_active"), PERMISSIONS.SCHOOL_STATUS);
  assert.equal(platformOperationPermission("activate_school"), PERMISSIONS.SCHOOL_STATUS);
});

test("principal removal requires principal management permission", () => {
  assert.equal(platformOperationPermission("remove_principal"), PERMISSIONS.PRINCIPAL_MANAGE);
});

test("billing mutations require billing permission", () => {
  assert.equal(platformOperationPermission("save_subscription"), PERMISSIONS.BILLING_MANAGE);
  assert.equal(platformOperationPermission("record_payment"), PERMISSIONS.BILLING_MANAGE);
  assert.equal(platformOperationPermission("mark_overdue"), PERMISSIONS.BILLING_MANAGE);
});

test("unknown platform operations are rejected", () => {
  assert.equal(platformOperationPermission("delete_everything"), null);
});
