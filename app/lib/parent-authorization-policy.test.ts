import test from "node:test";
import assert from "node:assert/strict";
import {
  parentCanAccessLearnerAtSchool,
  parentCanAccessSchool,
} from "./parent-authorization-policy";

const children = [
  { id: "learner-a", school_id: 11 },
  { id: "learner-b", school_id: 22 },
];

test("a parent can access a learner only within that learner's school", () => {
  assert.equal(parentCanAccessLearnerAtSchool(children, 11, "learner-a"), true);
  assert.equal(parentCanAccessLearnerAtSchool(children, 22, "learner-b"), true);
});

test("separate learner and school matches cannot be combined across schools", () => {
  assert.equal(parentCanAccessSchool(children, 22), true);
  assert.equal(parentCanAccessLearnerAtSchool(children, 22, "learner-a"), false);
});

test("school relations are supported without weakening learner isolation", () => {
  const relatedChildren = [{ id: 7, schools: [{ id: 33 }] }];
  assert.equal(parentCanAccessLearnerAtSchool(relatedChildren, 33, "7"), true);
  assert.equal(parentCanAccessLearnerAtSchool(relatedChildren, 44, "7"), false);
});

test("missing school or learner context is denied", () => {
  assert.equal(parentCanAccessSchool(children, 0), false);
  assert.equal(parentCanAccessLearnerAtSchool(children, 11, ""), false);
});
