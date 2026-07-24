import test from "node:test";
import assert from "node:assert/strict";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  sanitizeDelegatedPermissions,
  selectablePermissionsForRole,
} from "./permissions";
import { effectivePermissions } from "./authorization-policy";

test("master retains every permission", () => {
  assert.deepEqual(new Set(ROLE_PERMISSIONS.master), new Set(Object.values(PERMISSIONS)));
});

test("master admin cannot manage platform administrators", () => {
  assert.equal(ROLE_PERMISSIONS.master_admin.includes(PERMISSIONS.PLATFORM_ADMIN_MANAGE), false);
});

test("preschool admin can be delegated every school-level module", () => {
  assert.equal(ROLE_PERMISSIONS.admin.includes(PERMISSIONS.INCIDENT_REVIEW), true);
  assert.equal(ROLE_PERMISSIONS.admin.includes(PERMISSIONS.BILLING_MANAGE), true);
  assert.equal(ROLE_PERMISSIONS.admin.includes(PERMISSIONS.LEARNERS_MANAGE), true);
  assert.equal(ROLE_PERMISSIONS.admin.includes(PERMISSIONS.DBE_MANAGE), true);
  assert.equal(ROLE_PERMISSIONS.admin.includes(PERMISSIONS.SCHOOL_ONBOARD), false);
  assert.equal(ROLE_PERMISSIONS.admin.includes(PERMISSIONS.PLATFORM_ADMIN_MANAGE), false);
});

test("teacher cannot manage staff or classrooms", () => {
  assert.equal(ROLE_PERMISSIONS.teacher.includes(PERMISSIONS.STAFF_MANAGE), false);
  assert.equal(ROLE_PERMISSIONS.teacher.includes(PERMISSIONS.CLASSROOM_ASSIGN), false);
  assert.equal(ROLE_PERMISSIONS.teacher.includes(PERMISSIONS.REQUIREMENTS_TRACK), true);
  assert.equal(ROLE_PERMISSIONS.teacher.includes(PERMISSIONS.REQUIREMENTS_MANAGE), false);
});

test("owner is school-scoped and cannot onboard platform schools", () => {
  assert.equal(ROLE_PERMISSIONS.owner.includes(PERMISSIONS.SCHOOL_MANAGE), true);
  assert.equal(ROLE_PERMISSIONS.owner.includes(PERMISSIONS.SCHOOL_ONBOARD), false);
});

test("preschool admin checklist includes principal school modules but excludes platform tools", () => {
  const options = selectablePermissionsForRole("admin").map((option) => option.permission);
  assert.equal(options.includes(PERMISSIONS.BILLING_MANAGE), true);
  assert.equal(options.includes(PERMISSIONS.INCIDENT_REVIEW), true);
  assert.equal(options.includes(PERMISSIONS.MESSAGE_SEND), true);
  assert.equal(options.includes(PERMISSIONS.SCHOOL_ONBOARD), false);
});

test("master admin checklist cannot grant platform admin management", () => {
  const selected = sanitizeDelegatedPermissions("master_admin", [
    PERMISSIONS.SCHOOL_ONBOARD,
    PERMISSIONS.PLATFORM_ADMIN_MANAGE,
  ]);
  assert.deepEqual(selected, [PERMISSIONS.SCHOOL_ONBOARD]);
});

test("a delegated checklist restricts permissions to the explicit selection", () => {
  assert.deepEqual(
    effectivePermissions("admin", [PERMISSIONS.MESSAGE_VIEW]),
    [PERMISSIONS.MESSAGE_VIEW]
  );
});

test("legacy delegated accounts with no stored checklist retain safe defaults", () => {
  assert.deepEqual(effectivePermissions("admin"), [...ROLE_PERMISSIONS.admin]);
});
