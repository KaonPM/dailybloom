import test from "node:test";
import assert from "node:assert/strict";
import { PERMISSIONS } from "./permissions";
import { canManageRole, validateManagedPermissions } from "./role-management";

test("only master can manage owners and master admins", () => {
  assert.equal(canManageRole("master", "owner"), true);
  assert.equal(canManageRole("principal", "owner"), false);
  assert.equal(canManageRole("master", "master_admin"), true);
  assert.equal(canManageRole("master_admin", "master_admin"), false);
});

test("principal and owner can manage preschool admins", () => {
  assert.equal(canManageRole("principal", "admin"), true);
  assert.equal(canManageRole("owner", "admin"), true);
  assert.equal(canManageRole("admin", "admin"), false);
});

test("forbidden delegated permissions are removed", () => {
  assert.deepEqual(
    validateManagedPermissions("admin", [
      PERMISSIONS.MESSAGE_VIEW,
      PERMISSIONS.BILLING_MANAGE,
    ]),
    [PERMISSIONS.MESSAGE_VIEW]
  );
});

test("delegated roles require a non-empty safe checklist", () => {
  assert.throws(
    () => validateManagedPermissions("master_admin", [PERMISSIONS.PLATFORM_ADMIN_MANAGE]),
    /Select at least one permission/
  );
});
