export type ExpiryState = "Current" | "Expiring Soon" | "Expired" | "No Expiry";

export function classifyExpiry(expiryDate?: string | null, now = new Date(), thresholdDays = 30): ExpiryState {
  if (!expiryDate) return "No Expiry";
  const expiry = new Date(`${expiryDate}T23:59:59.999Z`);
  if (Number.isNaN(expiry.valueOf())) return "No Expiry";
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = Math.floor((expiry.valueOf() - start.valueOf()) / 86_400_000);
  if (days < 0) return "Expired";
  if (days <= thresholdDays) return "Expiring Soon";
  return "Current";
}

export type ReadinessRequirement = {
  status: string;
  required?: boolean;
  active?: boolean;
  applicable?: boolean;
  effective_from?: string | null;
  effective_to?: string | null;
};

export function calculateReadiness(requirements: ReadinessRequirement[], now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const applicable = requirements.filter((item) =>
    item.active !== false && item.required !== false && item.applicable !== false &&
    (!item.effective_from || item.effective_from <= today) &&
    (!item.effective_to || item.effective_to >= today) && item.status !== "Not Applicable"
  );
  const ready = applicable.filter((item) => item.status === "Ready").length;
  return { ready, total: applicable.length, percent: applicable.length ? Math.round((ready / applicable.length) * 100) : null };
}

export function correctiveActionState(status: string, dueDate?: string | null, now = new Date()) {
  if (["Closed", "Cancelled"].includes(status) || !dueDate) return status;
  return dueDate < now.toISOString().slice(0, 10) ? "Overdue" : status;
}
