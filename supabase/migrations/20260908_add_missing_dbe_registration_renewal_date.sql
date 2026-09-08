-- Production reconciliation: the existing Registration UI and API already
-- read and write renewal_date, but the reconciled deployed baseline omitted it.
-- This is additive only and preserves every existing registration row.
alter table public.dbe_registration
  add column if not exists renewal_date date;
