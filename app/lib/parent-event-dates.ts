import { getJohannesburgDate } from "./classroom-activity-dates";

export type ParentEventRange = "Today" | "This Week" | "This Month" | "Upcoming";

function addCalendarDays(dateOnly: string, days: number) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().split("T")[0];
}

function getMonthEnd(dateOnly: string) {
  const [year, month] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().split("T")[0];
}

export function getJohannesburgTomorrowDate(date = new Date()) {
  return addCalendarDays(getJohannesburgDate(date), 1);
}

export function getParentEventDateRange(
  range: ParentEventRange,
  date = new Date()
) {
  const today = getJohannesburgDate(date);

  if (range === "Today") {
    return { from: today, to: today };
  }

  if (range === "This Week") {
    return { from: today, to: addCalendarDays(today, 7) };
  }

  if (range === "This Month") {
    return { from: today, to: getMonthEnd(today) };
  }

  return { from: today, to: null };
}
