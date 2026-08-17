-- Category-specific age ranges and complete pre-added defaults. This migration is
-- intentionally self-contained for databases that have not run the earlier age-
-- template migration. No fee, banking or other school configuration is changed.
alter table public.school_enrolment_requirement_templates
  add column if not exists template_key text not null default '2_6'
    check (template_key in ('0_2', '2_6')),
  add column if not exists available_from_months integer not null default 24
    check (available_from_months between 0 and 84),
  add column if not exists available_to_months integer not null default 72
    check (available_to_months between 0 and 84);

do $$
declare
  old_constraint record;
begin
  -- PostgreSQL truncates long generated constraint names, so identify the legacy
  -- unique rule by its definition instead of relying on a particular name.
  for old_constraint in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.school_enrolment_requirement_templates'::regclass
      and con.contype = 'u'
      and pg_get_constraintdef(con.oid) = 'UNIQUE (school_id, category, item_name)'
  loop
    execute format('alter table public.school_enrolment_requirement_templates drop constraint %I', old_constraint.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.school_enrolment_requirement_templates'::regclass
      and conname = 'school_req_template_item_unique'
  ) then
    alter table public.school_enrolment_requirement_templates
      add constraint school_req_template_item_unique
      unique (school_id, template_key, category, item_name);
  end if;
end $$;

update public.school_enrolment_requirement_templates
set available_from_months = case when category = 'hygiene' then 0 else 6 end,
    available_to_months = 24
where template_key = '0_2';

update public.school_enrolment_requirement_templates
set available_from_months = 24,
    available_to_months = 72
where template_key = '2_6' and available_to_months = 72;

insert into public.school_enrolment_requirement_templates
  (school_id, template_key, available_from_months, available_to_months, category, item_name, quantity, is_required, display_order)
select school.id, item.template_key, item.from_months, item.to_months, item.category, item.item_name, item.quantity, true, item.display_order
from public.schools school cross join (values
  ('0_2', 0, 24, 'hygiene', 1, 'Toilet Rolls', '10'),
  ('0_2', 0, 24, 'hygiene', 2, 'Tissue Box', '3'),
  ('0_2', 0, 24, 'hygiene', 3, 'Wipes (80 per pack)', '6'),
  ('0_2', 0, 24, 'hygiene', 4, 'Big Vaseline', '3'),
  ('0_2', 0, 24, 'hygiene', 5, 'Lifebuoy Soap / Sunlight Bar Soap', '4'),
  ('0_2', 6, 24, 'stationery', 6, 'Flip File (20 pages)', '1'),
  ('0_2', 6, 24, 'stationery', 7, 'College Book Exercise (72 pages)', '1'),
  ('0_2', 6, 24, 'stationery', 8, 'Colouring Book', '1'),
  ('0_2', 6, 24, 'stationery', 9, 'Typek', '1'),
  ('0_2', 6, 24, 'stationery', 10, 'Wax Crayons (box of 12)', '1'),
  ('0_2', 6, 24, 'stationery', 11, 'Long Pencils', '4'),
  ('0_2', 6, 24, 'stationery', 12, 'Rubber (eraser)', '1'),
  ('0_2', 6, 24, 'stationery', 13, 'Glue Stick (Pritt)', '1'),
  ('0_2', 6, 24, 'stationery', 14, 'Sharpener', '1'),
  ('2_6', 24, 72, 'hygiene', 1, 'Toilet Rolls', '10'),
  ('2_6', 24, 72, 'hygiene', 2, 'Tissue Box', '3'),
  ('2_6', 24, 72, 'hygiene', 3, 'Wipes (80 per pack)', '6'),
  ('2_6', 24, 72, 'hygiene', 4, 'Big Vaseline', '3'),
  ('2_6', 24, 72, 'hygiene', 5, 'Lifebuoy Soap / Sunlight Bar Soap', '4'),
  ('2_6', 24, 72, 'stationery', 6, 'Flip File (20 pages)', '1'),
  ('2_6', 24, 72, 'stationery', 7, 'College Book Exercise (72 pages)', '1'),
  ('2_6', 24, 72, 'stationery', 8, 'Colouring Book', '1'),
  ('2_6', 24, 72, 'stationery', 9, 'Typek', '1'),
  ('2_6', 24, 72, 'stationery', 10, 'Wax Crayons (box of 12)', '1'),
  ('2_6', 24, 72, 'stationery', 11, 'Long Pencils', '4'),
  ('2_6', 24, 72, 'stationery', 12, 'Rubber (eraser)', '1'),
  ('2_6', 24, 72, 'stationery', 13, 'Glue Stick (Pritt)', '1'),
  ('2_6', 24, 72, 'stationery', 14, 'Sharpener', '1')
) as item(template_key, from_months, to_months, category, display_order, item_name, quantity)
on conflict (school_id, template_key, category, item_name) do nothing;
