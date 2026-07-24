export type OpenInvoiceBalance = {
  id: string;
  amountPaid: number;
  balanceDue: number;
  totalAmount: number;
};

export type PaymentAllocationPlan = {
  allocations: Array<{
    invoiceId: string;
    amount: number;
    nextAmountPaid: number;
    nextBalanceDue: number;
    nextStatus: "partially_paid" | "paid";
  }>;
  creditBalance: number;
  outstandingBalance: number;
};

export function allocatePaymentOldestFirst(
  invoices: readonly OpenInvoiceBalance[],
  paymentAmount: number
): PaymentAllocationPlan {
  let remaining = Math.max(0, Number(paymentAmount || 0));
  const allocations: PaymentAllocationPlan["allocations"] = [];

  for (const invoice of invoices) {
    if (remaining <= 0) break;
    const currentBalance = Math.max(0, Number(invoice.balanceDue || 0));
    const allocation = Math.min(remaining, currentBalance);
    if (allocation <= 0) continue;

    const nextAmountPaid = Number(invoice.amountPaid || 0) + allocation;
    const nextBalanceDue = Math.max(
      0,
      Number(invoice.totalAmount || 0) - nextAmountPaid
    );
    allocations.push({
      invoiceId: invoice.id,
      amount: allocation,
      nextAmountPaid,
      nextBalanceDue,
      nextStatus: nextBalanceDue === 0 ? "paid" : "partially_paid",
    });
    remaining -= allocation;
  }

  const outstandingBalance = invoices.reduce((sum, invoice) => {
    const allocation = allocations.find(
      (item) => item.invoiceId === invoice.id
    );
    return (
      sum +
      (allocation
        ? allocation.nextBalanceDue
        : Math.max(0, Number(invoice.balanceDue || 0)))
    );
  }, 0);

  return {
    allocations,
    creditBalance: Math.max(0, remaining),
    outstandingBalance,
  };
}
