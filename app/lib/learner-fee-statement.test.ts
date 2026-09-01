import assert from "node:assert/strict";
import test from "node:test";
import { statementAccount } from "./learner-fee-statement";

const charges = [
  { id: 1, billing_period: "2026-08-01", amount: 1000, is_scheduled: false },
  { id: 2, billing_period: "2026-09-01", amount: 1000, is_scheduled: false },
  { id: 3, billing_period: "2026-09-01", amount: 250, is_scheduled: false },
];

test("monthly statements use allocations when one payment settles multiple charges", () => {
  const account = statementAccount(
    charges,
    [{ id: 10, amount: 1250, allocation_period: "2026-09-01" }],
    [
      { payment_id: 10, charge_id: 1, amount: 1000 },
      { payment_id: 10, charge_id: 3, amount: 250 },
    ],
    "2026-09"
  );

  assert.equal(account.openingBalance, 0);
  assert.equal(account.totalCharged, 1250);
  assert.equal(account.totalPaid, 250);
  assert.equal(account.balance, 1000);
  assert.equal(account.payments[0]?.amount, 250);
});

test("unallocated overpayments stay as a credit in the selected payment month", () => {
  const account = statementAccount(
    [{ id: 1, billing_period: "2026-09-01", amount: 250, is_scheduled: false }],
    [{ id: 10, amount: 400, allocation_period: "2026-09-01" }],
    [{ payment_id: 10, charge_id: 1, amount: 250 }],
    "2026-09"
  );

  assert.equal(account.totalPaid, 400);
  assert.equal(account.balance, -150);
});
