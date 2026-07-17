import assert from "node:assert/strict";
import test from "node:test";
import { getJohannesburgDate } from "./classroom-activity-dates";

test("uses the Johannesburg calendar date around UTC midnight", () => {
  assert.equal(
    getJohannesburgDate(new Date("2026-07-16T22:30:00.000Z")),
    "2026-07-17"
  );
});

test("keeps the same Johannesburg date during the daytime", () => {
  assert.equal(
    getJohannesburgDate(new Date("2026-07-17T12:00:00.000Z")),
    "2026-07-17"
  );
});
