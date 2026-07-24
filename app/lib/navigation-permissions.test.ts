import test from "node:test";
import assert from "node:assert/strict";
import { PERMISSIONS } from "./permissions";
import { permissionForSchoolPath } from "./navigation-permissions";

test("school routes map to the matching delegated permission", () => {
  assert.equal(permissionForSchoolPath("/children"), PERMISSIONS.LEARNERS_MANAGE);
  assert.equal(permissionForSchoolPath("/dbe-registration/documents"), PERMISSIONS.DBE_MANAGE);
  assert.equal(permissionForSchoolPath("/billing"), PERMISSIONS.BILLING_MANAGE);
  assert.equal(permissionForSchoolPath("/dashboard"), null);
});
