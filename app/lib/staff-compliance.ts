import { classifyExpiry } from "./compliance";

export type StaffComplianceItem = {
  status?: string | null;
  expiry_date?: string | null;
  verification_status?: string | null;
};

export type StaffComplianceSummary = {
  missing: number;
  inProgress: number;
  ready: number;
  needsReview: number;
  expiringSoon: number;
  expired: number;
  notApplicable: number;
};

export function summarizeStaffCompliance(items: StaffComplianceItem[], now = new Date()): StaffComplianceSummary {
  const summary: StaffComplianceSummary = { missing: 0, inProgress: 0, ready: 0, needsReview: 0, expiringSoon: 0, expired: 0, notApplicable: 0 };
  for (const item of items) {
    const status = String(item.status || "Not Started");
    if (status === "Not Applicable") { summary.notApplicable += 1; continue; }
    if (status === "Missing" || status === "Not Started") { summary.missing += 1; continue; }
    if (status === "In Progress") { summary.inProgress += 1; continue; }
    if (status === "Needs Review") { summary.needsReview += 1; continue; }
    const expiry = classifyExpiry(item.expiry_date, now);
    if (expiry === "Expired") { summary.expired += 1; continue; }
    if (expiry === "Expiring Soon") { summary.expiringSoon += 1; continue; }
    summary.ready += 1;
  }
  return summary;
}

export function staffMatchesFilters(
  staff: { full_name?: string | null; role?: string | null; active: boolean; summary: StaffComplianceSummary },
  filters: { search?: string; role?: string; activity?: string; state?: string }
) {
  const search = String(filters.search || "").trim().toLowerCase();
  if (search && !`${staff.full_name || ""} ${staff.role || ""}`.toLowerCase().includes(search)) return false;
  if (filters.role && filters.role !== "All" && staff.role !== filters.role) return false;
  if (filters.activity === "Active" && !staff.active) return false;
  if (filters.activity === "Inactive" && staff.active) return false;
  const state = filters.state || "All";
  if (state === "Missing") return staff.summary.missing > 0;
  if (state === "Expiring Soon") return staff.summary.expiringSoon > 0;
  if (state === "Expired") return staff.summary.expired > 0;
  if (state === "Current/Ready") return staff.summary.ready > 0 && staff.summary.missing === 0 && staff.summary.expired === 0;
  return true;
}
