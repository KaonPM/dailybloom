-- Keep setup-fee exemptions compatible with the required journal effective date.
-- The operation remains atomic: the invoice and its audit journal are changed
-- together inside this function.

create or replace function public.apply_setup_fee_exemption(
  target_school_id bigint,
  exemption_reason text,
  actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  target_invoice public.billing_invoices%rowtype;
  exemption_effective_date date := (now() at time zone 'Africa/Johannesburg')::date;
begin
  if char_length(trim(coalesce(exemption_reason, ''))) < 3 then
    raise exception 'An exemption reason of at least 3 characters is required.';
  end if;

  select *
    into target_invoice
    from public.billing_invoices
   where school_id = target_school_id
     and charge_type = 'setup_fee'
   for update;

  if target_invoice.id is null then
    raise exception 'The setup-fee invoice was not found.';
  end if;
  if target_invoice.exempted_at is not null then
    return target_invoice.id;
  end if;

  -- Preserve recorded payments. Only remove their allocations to this setup
  -- invoice; reconciliation moves them to a subscription charge or retains
  -- them as school credit.
  delete from public.billing_payment_allocations
   where invoice_id = target_invoice.id;

  update public.billing_invoices
     set description = description || ' - Setup fee exempted',
         amount_paid = 0,
         balance_due = 0,
         status = 'paid',
         exemption_reason = trim(exemption_reason),
         exempted_at = now(),
         exempted_by = actor_id,
         updated_at = now()
   where id = target_invoice.id;

  insert into public.billing_journal_entries (
    school_id,
    invoice_id,
    entry_type,
    amount,
    reason,
    created_by,
    effective_date
  )
  values (
    target_school_id,
    target_invoice.id,
    'setup_fee_exemption',
    target_invoice.total_amount,
    trim(exemption_reason),
    actor_id,
    exemption_effective_date
  )
  on conflict (invoice_id, entry_type)
  where invoice_id is not null and entry_type = 'setup_fee_exemption'
  do nothing;

  return target_invoice.id;
end;
$$;

revoke all on function public.apply_setup_fee_exemption(bigint, text, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_setup_fee_exemption(bigint, text, uuid)
  to service_role;

comment on function public.apply_setup_fee_exemption(bigint, text, uuid) is
  'Atomically exempts a setup-fee invoice and records a dated internal billing journal.';
