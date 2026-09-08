export const ACTION_STATUSES = ["Open", "In Progress", "Ready for Verification", "Closed", "Reopened"] as const;
export type CorrectiveActionStatus = typeof ACTION_STATUSES[number];
export const ACTION_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export type CorrectiveActionPriority = typeof ACTION_PRIORITIES[number];

const transitions: Record<CorrectiveActionStatus, readonly CorrectiveActionStatus[]> = {
  Open: ["In Progress"],
  "In Progress": ["Ready for Verification"],
  "Ready for Verification": ["Closed", "In Progress"],
  Closed: ["Reopened"],
  Reopened: ["In Progress"],
};

export function isCorrectiveActionStatus(value: unknown): value is CorrectiveActionStatus {
  return ACTION_STATUSES.includes(value as CorrectiveActionStatus);
}

export function normalizeCorrectiveActionPriority(value: unknown): CorrectiveActionPriority {
  const text = String(value || "").trim();
  return ACTION_PRIORITIES.includes(text as CorrectiveActionPriority)
    ? text as CorrectiveActionPriority
    : text === "Normal" ? "Medium" : "Medium";
}

export function isCorrectiveActionTransition(from: unknown, to: unknown) {
  return isCorrectiveActionStatus(from) && isCorrectiveActionStatus(to) && transitions[from].includes(to);
}

export function correctiveActionTiming(status: unknown, dueDate?: string | null, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const due = dueDate || null;
  const closed = status === "Closed";
  return {
    overdue: Boolean(due && !closed && due < today),
    dueSoon: Boolean(due && !closed && due >= today && due <= new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10)),
  };
}

export type CorrectiveActionListItem = {
  id: string;
  status: string;
  due_date: string | null;
  priority: string;
  created_at?: string | null;
};

const priorityWeight: Record<CorrectiveActionPriority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export function sortCorrectiveActions<T extends CorrectiveActionListItem>(items: T[], now = new Date()) {
  return [...items].sort((left, right) => {
    const rank = (item: T) => {
      const timing = correctiveActionTiming(item.status, item.due_date, now);
      const priority = priorityWeight[normalizeCorrectiveActionPriority(item.priority)];
      if (timing.overdue) return [0, priority];
      if (item.status === "Open" || item.status === "In Progress" || item.status === "Reopened") return [1, priority];
      if (item.status === "Ready for Verification") return [2, priority];
      if (item.status === "Closed") return [4, priority];
      return [3, priority];
    };
    const [leftRank, leftPriority] = rank(left); const [rightRank, rightPriority] = rank(right);
    if (leftRank !== rightRank) return leftRank - rightRank;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    const leftDate = left.due_date || "9999-12-31"; const rightDate = right.due_date || "9999-12-31";
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    return String(right.created_at || "").localeCompare(String(left.created_at || ""));
  });
}

export function summarizeCorrectiveActions(items: CorrectiveActionListItem[], now = new Date()) {
  const timing = items.map((item) => correctiveActionTiming(item.status, item.due_date, now));
  return {
    open: items.filter((item) => item.status === "Open").length,
    inProgress: items.filter((item) => item.status === "In Progress" || item.status === "Reopened").length,
    readyForVerification: items.filter((item) => item.status === "Ready for Verification").length,
    closed: items.filter((item) => item.status === "Closed").length,
    overdue: timing.filter((item) => item.overdue).length,
    dueSoon: timing.filter((item) => item.dueSoon).length,
    active: items.filter((item) => item.status !== "Closed").length,
  };
}
