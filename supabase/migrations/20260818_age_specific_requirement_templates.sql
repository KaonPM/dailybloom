-- Separate the learner-requirement defaults into editable 0-2 and 2-6 templates.
alter table public.school_enrolment_requirement_templates
  add column if not exists template_key text not null default '2_6'
    check (template_key in ('0_2', '2_6')),
  add column if not exists available_from_months integer not null default 24
    check (available_from_months between 0 and 84);

alter table public.school_enrolment_requirement_templates
  drop constraint if exists school_enrolment_requirement_templates_school_id_category_item_name_key;

alter table public.school_enrolment_requirement_templates
  add constraint school_enrolment_requirement_templates_school_template_category_item_key
  unique (school_id, template_key, category, item_name);

-- Existing items remain in the 2-6 template. Add the 0-2 starter template without
-- changing any school-edited quantities or wording.
insert into public.school_enrolment_requirement_templates
  (school_id, template_key, available_from_months, category, item_name, quantity, is_required, display_order)
select school.id, '0_2', 6, 'hygiene', item.item_name, item.quantity, true, item.display_order
from public.schools school cross join (values
  (1, 'Toilet Rolls', '10'),
  (2, 'Tissue Box', '3'),
  (3, 'Wipes (80 per pack)', '6'),
  (4, 'Big Vaseline', '3'),
  (5, 'Lifebuoy Soap / Sunlight Bar Soap', '4')
) as item(display_order, item_name, quantity)
on conflict (school_id, template_key, category, item_name) do nothing;

update public.school_enrolment_requirement_templates
set available_from_months = 6
where template_key = '0_2' and available_from_months = 24;

create index if not exists school_enrolment_requirement_templates_template_idx
  on public.school_enrolment_requirement_templates (school_id, template_key, is_active, display_order);
