-- Staff Compliance P2: preserve the existing people model and make scoped staff
-- lookups and one configured requirement per staff member efficient.
create index if not exists staff_compliance_items_school_staff_status_idx
  on public.staff_compliance_items (school_id, staff_user_id, status);

create unique index if not exists staff_compliance_items_school_staff_requirement_key
  on public.staff_compliance_items (school_id, staff_user_id, requirement_id)
  where requirement_id is not null;
