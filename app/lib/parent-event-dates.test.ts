import assert from "node:assert/strict";
import test from "node:test";
import {
  getJohannesburgTomorrowDate,
  getParentEventDateRange,
} from "./parent-event-dates";

test("tomorrow follows the Johannesburg calendar date", () => {
  const lateUtc = new Date("2026-08-03T22:30:00.000Z");
  assert.equal(getJohannesburgTomorrowDate(lateUtc), "2026-08-05");
});

test("upcoming events are not cut off at the end of the year", () => {
  const date = new Date("2026-12-30T10:00:00.000Z");
  assert.deepEqual(getParentEventDateRange("Upcoming", date), {
    from: "2026-12-30",
    to: null,
  });
});

test("this month includes leap day", () => {
  const date = new Date("2028-02-10T10:00:00.000Z");
  assert.deepEqual(getParentEventDateRange("This Month", date), {
    from: "2028-02-10",
    to: "2028-02-29",
  });
});
