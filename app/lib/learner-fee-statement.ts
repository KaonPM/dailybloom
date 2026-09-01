export type LearnerFeeCharge = {
  id: number | string;
  billing_period?: string | null;
  amount?: number | null;
  is_scheduled?: boolean | null;
};

export type LearnerFeePayment = {
  id: number | string;
  amount?: number | null;
  allocation_period?: string | null;
};

export type LearnerFeeAllocation = {
  charge_id: number | string;
  payment_id: number | string;
  amount?: number | null;
};

const periodOf = (value?: string | null) => String(value || "").slice(0, 7);
const idOf = (value: number | string) => String(value);

// A payment may settle more than one month. Statements therefore derive each
// month's payment column from the recorded allocations, not from the month a
// staff member selected while capturing the payment. Unallocated overpayments
// remain a credit in that selected month.
export function statementAccount(
  charges: LearnerFeeCharge[],
  payments: LearnerFeePayment[],
  allocations: LearnerFeeAllocation[],
  period?: string | null
) {
  const postedCharges = charges.filter((charge) => !charge.is_scheduled);
  if (!period) {
    const totalCharged = postedCharges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0);
    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return { charges, payments, openingBalance: 0, totalCharged, totalPaid, balance: totalCharged - totalPaid };
  }

  const chargePeriodById = new Map(postedCharges.map((charge) => [idOf(charge.id), periodOf(charge.billing_period)]));
  const allocatedByPayment = new Map<string, number>();
  const allocatedInPeriodByPayment = new Map<string, number>();
  let allocatedBeforePeriod = 0;
  for (const allocation of allocations) {
    const paymentId = idOf(allocation.payment_id);
    const amount = Number(allocation.amount || 0);
    const chargePeriod = chargePeriodById.get(idOf(allocation.charge_id)) || "";
    allocatedByPayment.set(paymentId, (allocatedByPayment.get(paymentId) || 0) + amount);
    if (chargePeriod === period) allocatedInPeriodByPayment.set(paymentId, (allocatedInPeriodByPayment.get(paymentId) || 0) + amount);
    if (chargePeriod < period) allocatedBeforePeriod += amount;
  }

  let priorUnallocatedPayments = 0;
  const periodPayments = payments.flatMap((payment) => {
    const paymentId = idOf(payment.id);
    const unallocated = Math.max(0, Number(payment.amount || 0) - (allocatedByPayment.get(paymentId) || 0));
    const selectedMonthCredit = periodOf(payment.allocation_period) === period ? unallocated : 0;
    if (periodOf(payment.allocation_period) < period) priorUnallocatedPayments += unallocated;
    const amount = (allocatedInPeriodByPayment.get(paymentId) || 0) + selectedMonthCredit;
    return amount > 0 ? [{ ...payment, amount }] : [];
  });
  const periodCharges = postedCharges.filter((charge) => periodOf(charge.billing_period) === period);
  const openingBalance = postedCharges.filter((charge) => periodOf(charge.billing_period) < period).reduce((sum, charge) => sum + Number(charge.amount || 0), 0) - allocatedBeforePeriod - priorUnallocatedPayments;
  const totalCharged = periodCharges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0);
  const totalPaid = periodPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return { charges: periodCharges, payments: periodPayments, openingBalance, totalCharged, totalPaid, balance: openingBalance + totalCharged - totalPaid };
}
