import test from "node:test";
import assert from "node:assert/strict";
import { PERMISSIONS } from "./permissions";
import { effectivePermissions, hasPermission, resolveSchoolAuthorization } from "./authorization-policy";

test("a school membership authorizes only its own school", () => {
  const memberships = [{ school_id: 11, role: "admin", permissions: [] }];
  assert.equal(resolveSchoolAuthorization({ requestedSchoolId: 22, profileSchoolId: 11, legacyRole: "admin", memberships }), null);
  assert.equal(resolveSchoolAuthorization({ requestedSchoolId: 11, profileSchoolId: 11, legacyRole: "admin", memberships })?.schoolId, 11);
});

test("legacy profile access cannot cross into another school", () => {
  assert.equal(resolveSchoolAuthorization({ requestedSchoolId: 22, profileSchoolId: 11, legacyRole: "principal", memberships: [] }), null);
  assert.equal(resolveSchoolAuthorization({ requestedSchoolId: 11, profileSchoolId: 11, legacyRole: "principal", memberships: [] })?.role, "principal");
});

test("a multi-school user receives the role belonging to the requested school", () => {
  const result = resolveSchoolAuthorization({
    requestedSchoolId: 22,
    profileSchoolId: 11,
    legacyRole: "principal",
    memberships: [
      { school_id: 11, role: "principal", permissions: [] },
      { school_id: 22, role: "admin", permissions: [PERMISSIONS.INCIDENT_REVIEW] },
    ],
  });
  assert.equal(result?.role, "admin");
  assert.equal(result?.permissions.includes(PERMISSIONS.INCIDENT_REVIEW), true);
  assert.equal(result?.permissions.includes(PERMISSIONS.BILLING_MANAGE), false);
});

test("additional membership permissions do not change the global role defaults", () => {
  const permissions = effectivePermissions("admin", [PERMISSIONS.INCIDENT_REVIEW]);
  assert.equal(hasPermission(permissions, PERMISSIONS.REQUIREMENTS_MANAGE), true);
  assert.equal(hasPermission(permissions, PERMISSIONS.INCIDENT_REVIEW), true);
  assert.equal(hasPermission(permissions, PERMISSIONS.PLATFORM_ADMIN_MANAGE), false);
});

test("a membership cannot borrow the legacy role from another school", () => {
  const result = resolveSchoolAuthorization({
    requestedSchoolId: 22,
    profileSchoolId: 11,
    legacyRole: "principal",
    memberships: [{ school_id: 22, role: "teacher", permissions: [] }],
  });
  assert.equal(result?.role, "teacher");
  assert.equal(hasPermission(result?.permissions || [], PERMISSIONS.STAFF_MANAGE), false);
});

test("an unknown school is denied even when another membership is privileged", () => {
  const result = resolveSchoolAuthorization({
    requestedSchoolId: 33,
    profileSchoolId: 11,
    legacyRole: "owner",
    memberships: [{ school_id: 22, role: "principal", permissions: [] }],
  });
  assert.equal(result, null);
});

test("a school-specific permission applies only to its matching membership", () => {
  const memberships = [
    { school_id: 11, role: "admin", permissions: [PERMISSIONS.INCIDENT_REVIEW] },
    { school_id: 22, role: "admin", permissions: [] },
  ];
  const school11 = resolveSchoolAuthorization({ requestedSchoolId: 11, memberships });
  const school22 = resolveSchoolAuthorization({ requestedSchoolId: 22, memberships });
  assert.equal(hasPermission(school11?.permissions || [], PERMISSIONS.INCIDENT_REVIEW), true);
  assert.equal(hasPermission(school22?.permissions || [], PERMISSIONS.INCIDENT_REVIEW), false);
});
