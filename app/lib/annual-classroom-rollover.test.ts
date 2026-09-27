import assert from "node:assert/strict";
import test from "node:test";
import { ageOnJanuaryFirst, johannesburgYearMonth, planAnnualClassroomRollover } from "./annual-classroom-rollover";

const classrooms = [
  { id: 10, classroom_name: "3-4 A", age_groups: ["3-4 Years"] },
  { id: 11, classroom_name: "3-4 B", age_groups: ["3-4 Years"] },
  { id: 12, classroom_name: "Grade R A", age_groups: ["5-6 Years"] },
];

test("calculates age on the first day of the academic year", () => {
  assert.equal(ageOnJanuaryFirst("2022-01-01", 2026), 4);
  assert.equal(ageOnJanuaryFirst("2022-01-02", 2026), 3);
  assert.equal(ageOnJanuaryFirst(null, 2026), null);
});

test("uses the Johannesburg year at the UTC new-year boundary", () => {
  assert.deepEqual(johannesburgYearMonth(new Date("2025-12-31T22:30:00Z")), { year: 2026, month: 1 });
});

test("balances learners across classrooms accepting the same age", () => {
  const plan = planAnnualClassroomRollover({
    academicYear: 2026,
    classrooms,
    learners: [
      { id: "a", date_of_birth: "2022-01-02", classroom_name: "Toddlers" },
      { id: "b", date_of_birth: "2022-02-02", classroom_name: "Toddlers" },
      { id: "c", date_of_birth: "2022-03-02", classroom_name: "Toddlers" },
    ],
  });
  assert.deepEqual(plan.allocations, [
    { learnerId: "a", classroomId: 10 },
    { learnerId: "b", classroomId: 11 },
    { learnerId: "c", classroomId: 10 },
  ]);
});

test("archives current Grade R and preserves an existing next-year placement", () => {
  const plan = planAnnualClassroomRollover({
    academicYear: 2026,
    classrooms,
    learners: [
      { id: "grade-r", date_of_birth: "2020-05-01", classroom_name: "Grade R B" },
      { id: "placed", date_of_birth: null, classroom_name: "Toddlers" },
      { id: "manual", date_of_birth: null, classroom_name: "Toddlers" },
    ],
    existingClassroomByLearner: new Map([["placed", 11]]),
    initialClassroomLoad: new Map([[11, 1]]),
  });
  assert.deepEqual(plan.archivedGradeRLearnerIds, ["grade-r"]);
  assert.deepEqual(plan.allocations, [{ learnerId: "placed", classroomId: 11 }]);
  assert.deepEqual(plan.awaitingManualLearnerIds, ["manual"]);
});
