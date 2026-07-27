begin;

alter table public.learners
  add column if not exists monthly_fee_type_id bigint
  references public.school_fee_types(id) on delete restrict;

update public.learners learner
set monthly_fee_type_id = fee.id
from public.school_fee_types fee
where learner.monthly_fee_type_id is null
  and fee.school_id = learner.school_id
  and fee.fee_category = 'monthly'
  and fee.is_active = true
  and fee.amount = learner.monthly_fee
  and fee.fee_code = 'monthly_school_fee';

create index if not exists learners_monthly_fee_type_idx
  on public.learners(school_id, monthly_fee_type_id)
  where coalesce(is_deleted, false) = false;

commit;
