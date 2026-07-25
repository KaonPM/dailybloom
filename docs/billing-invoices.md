# DailyBloom invoice and payment ledger

## Behaviour

- Activating a preschool creates one idempotent **DailyBloom Setup Fee — [Package] Package** invoice.
- Saving a setup date or opening Master Billing also reconciles older active
  schools that are missing their setup-fee invoice. This supports historical
  setup and payment dates without generating a duplicate setup charge.
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
```

The migration adds:

- `billing_invoices`
- `billing_payment_allocations`
- `subscription_payments.unapplied_amount`
- `subscription_payments.charge_type`
- `subscription_payments.plan_name`

Do not delete finalised invoices or payments. Corrections should be implemented
as reversals or credit adjustments so the audit history remains intact.
