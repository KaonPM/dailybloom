import { classifyExpiry, type ExpiryState } from "./compliance";

export type RenewalSource = "registration" | "document" | "staff" | "manual";
export type RenewalItem = {
  id: string;
  source_type: RenewalSource;
  source_id: string;
  school_id: number;
  title: string;
  category: string;
  holder: string;
  issue_date: string | null;
  expiry_date: string | null;
  expiry_status: ExpiryState;
  renewal_status: string | null;
  verification_status: string | null;
  linked_document_id: string | null;
  source_route: string;
  source_label: string;
  is_manual: boolean;
  possible_duplicate?: boolean;
};

export type RenewalSummary = { total: number; expiringSoon: number; expired: number; renewalInProgress: number; current: number; noExpiry: number; attention: number };

export function isRenewalInProgress(status?: string | null) {
  return ["In Progress", "Renewal In Progress"].includes(String(status || "").trim());
}

export function renewalDisplayStatus(item: Pick<RenewalItem, "expiry_status" | "renewal_status">) {
  const renewal = isRenewalInProgress(item.renewal_status);
  if (item.expiry_status === "Expired") return renewal ? "Expired · Renewal In Progress" : "Expired";
  if (renewal) return "Renewal In Progress";
  return item.expiry_status;
}

export function summarizeRenewals(items: RenewalItem[]): RenewalSummary {
  const summary = { total: items.length, expiringSoon: 0, expired: 0, renewalInProgress: 0, current: 0, noExpiry: 0, attention: 0 };
  for (const item of items) {
    if (item.expiry_status === "Expired") summary.expired += 1;
    else if (item.expiry_status === "Expiring Soon") summary.expiringSoon += 1;
    else if (item.expiry_status === "Current") summary.current += 1;
    else summary.noExpiry += 1;
    if (isRenewalInProgress(item.renewal_status)) summary.renewalInProgress += 1;
  }
  summary.attention = summary.expired + summary.expiringSoon;
  return summary;
}

export function sortRenewals(items: RenewalItem[]) {
  const rank: Record<ExpiryState, number> = { Expired: 0, "Expiring Soon": 1, Current: 3, "No Expiry": 4 };
  return [...items].sort((left, right) => {
    const leftRank = left.expiry_status === "Current" && isRenewalInProgress(left.renewal_status) ? 2 : rank[left.expiry_status];
    const rightRank = right.expiry_status === "Current" && isRenewalInProgress(right.renewal_status) ? 2 : rank[right.expiry_status];
    if (leftRank !== rightRank) return leftRank - rightRank;
    return String(left.expiry_date || "9999-12-31").localeCompare(String(right.expiry_date || "9999-12-31"));
  });
}

export function renewalItem(input: Omit<RenewalItem, "id" | "expiry_status"> & { source_id: string }, now = new Date()): RenewalItem {
  return { ...input, id: `${input.source_type}:${input.source_id}`, expiry_status: classifyExpiry(input.expiry_date, now) };
}
