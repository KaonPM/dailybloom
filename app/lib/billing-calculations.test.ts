import test from "node:test";
import assert from "node:assert/strict";
import { allocatePaymentOldestFirst } from "./billing-calculations";

const invoices = [
  { id: "setup", amountPaid: 0, balanceDue: 599, totalAmount: 599 },
  { id: "month", amountPaid: 0, balanceDue: 499, totalAmount: 499 },
];

test("allocates a payment to the oldest invoice first", () => {
  const result = allocatePaymentOldestFirst(invoices, 700);
  assert.deepEqual(
    result.allocations.map((item) => [item.invoiceId, item.amount, item.nextStatus]),
    [
      ["setup", 599, "paid"],
      ["month", 101, "partially_paid"],
    ]
  );
  assert.equal(result.creditBalance, 0);
  assert.equal(result.outstandingBalance, 398);
});

test("keeps an overpayment as credit", () => {
  const result = allocatePaymentOldestFirst(invoices, 1200);
  assert.equal(result.outstandingBalance, 0);
  assert.equal(result.creditBalance, 102);
  assert.equal(result.allocations.every((item) => item.nextStatus === "paid"), true);
});

test("preserves a short payment as an outstanding balance", () => {
  const result = allocatePaymentOldestFirst(invoices, 300);
  assert.equal(result.allocations[0].nextStatus, "partially_paid");
  assert.equal(result.outstandingBalance, 798);
  assert.equal(result.creditBalance, 0);
});
