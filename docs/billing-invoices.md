# DailyBloom invoice and payment ledger

## Behaviour

- Activating a preschool creates one idempotent **DailyBloom Setup Fee — [Package] Package** invoice.
- School creation now creates the setup-fee invoice immediately.
- Opening Master Billing reconciles every older school that is missing its
  setup-fee invoice, dated from the preschool's original creation date, without
  generating duplicate charges.
- If the school does not yet have a subscription record, activation creates one from the package stored on the school.
- Activation schedules the first subscription invoice for the next first of the
  month and keeps the subscription active for the continuous monthly flow.
- On the first of every month, the billing cron creates one subscription invoice per active/trial subscription.
- Monthly invoice descriptions preserve the package snapshot, for example **Bloom Elite Subscription Package — August 2026**.
- Payments are allocated to the oldest outstanding invoice first.
- A short payment leaves an amount due and marks an invoice partially paid.
- An overpayment remains as credit on the payment and is automatically applied to future invoices.
- Each payment preserves its selected setup/subscription type, DailyBloom
  package snapshot, payment method and actual payment date.
- Confirming a payment opens the affected invoice as a payment receipt while
  the normal allocation and monthly billing process continues.
- Payment history is grouped by preschool, with every payment and its related
  invoices available under that school account. Master can view or resend each
  invoice from the school history.
- School billing accounts are compact and collapsed by default so the layout
  remains manageable as continuous monthly invoices accumulate.
- A setup-fee exemption is recorded as an immutable billing journal. The
  setup-fee invoice remains visible at R0.00, shows the exemption reason, and is
  emailed to the principal or owner. An invoice with an existing payment cannot
  be exempted.
- Billing balances continue across calendar years. Invoice numbers include their year, but account balances are never reset.
- DailyBloom is not VAT registered. Every document states that no VAT was charged and `vat_amount` is constrained to zero.

## School delivery

- A newly generated invoice appears on the preschool dashboard.
- The invoice is available under **Billing → Invoices**.
- The school can print it, save the secure document as PDF or download a generated PDF.
- Activation and monthly invoice generation email the principal/owner a secure document link.
- A manual **Email** action is available from the invoice list.

Invoices and receipts now appear directly inside **Billing**. The invoice area
stays hidden until **View Invoices & Receipts** is selected, then opens at the
top of the Billing page.

## Scheduling

Vercel invokes `/api/cron/billing-invoices` at `07:00 UTC` on the first of each
month (`09:00` South African Standard Time). The route requires:

```text
CRON_SECRET
```

Vercel cron requests send this value as a bearer token.

## Configuration

Optional:

```text
DAILYBLOOM_SETUP_FEE=599
DAILYBLOOM_FROM_EMAIL=DailyBloom <info@dailybloom.co.za>
NEXT_PUBLIC_APP_URL=https://dailybloom.co.za
```

`RESEND_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` must already be configured.

## Database

Run:

```text
supabase/migrations/20260724_billing_invoice_ledger.sql
supabase/migrations/20260724_payment_details.sql
supabase/migrations/20260725_setup_fee_exemption_journals.sql
supabase/migrations/20260725_backfill_billing_history.sql
```

The migration adds:

- `billing_invoices`
- `billing_payment_allocations`
- `subscription_payments.unapplied_amount`
- `subscription_payments.charge_type`
- `subscription_payments.plan_name`

Do not delete finalised invoices or payments. Corrections should be implemented
as reversals or credit adjustments so the audit history remains intact.
