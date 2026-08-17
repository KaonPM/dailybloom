-- Ensure both age templates contain the DailyBloom starter items. Existing rows
-- win on conflict, so school-edited names/quantities and all unrelated setup data
-- (including fees) remain untouched.
insert into public.school_enrolment_requirement_templates
  (school_id, template_key, available_from_months, category, item_name, quantity, is_required, display_order)
select school.id, item.template_key, item.available_from_months, item.category, item.item_name, item.quantity, true, item.display_order
from public.schools school cross join (values
  ('0_2', 6, 'hygiene', 1, 'Toilet Rolls', '10'),
  ('0_2', 6, 'hygiene', 2, 'Tissue Box', '3'),
  ('0_2', 6, 'hygiene', 3, 'Wipes (80 per pack)', '6'),
  ('0_2', 6, 'hygiene', 4, 'Big Vaseline', '3'),
  ('0_2', 6, 'hygiene', 5, 'Lifebuoy Soap / Sunlight Bar Soap', '4'),
  ('2_6', 24, 'hygiene', 1, 'Toilet Rolls', '10'),
  ('2_6', 24, 'hygiene', 2, 'Tissue Box', '3'),
  ('2_6', 24, 'hygiene', 3, 'Wipes (80 per pack)', '6'),
  ('2_6', 24, 'hygiene', 4, 'Big Vaseline', '3'),
  ('2_6', 24, 'hygiene', 5, 'Lifebuoy Soap / Sunlight Bar Soap', '4'),
  ('2_6', 24, 'stationery', 6, 'Flip File (20 pages)', '1'),
  ('2_6', 24, 'stationery', 7, 'College Book Exercise (72 pages)', '1'),
  ('2_6', 24, 'stationery', 8, 'Colouring Book', '1'),
  ('2_6', 24, 'stationery', 9, 'Typek', '1'),
  ('2_6', 24, 'stationery', 10, 'Wax Crayons (box of 12)', '1'),
  ('2_6', 24, 'stationery', 11, 'Long Pencils', '4'),
  ('2_6', 24, 'stationery', 12, 'Rubber (eraser)', '1'),
  ('2_6', 24, 'stationery', 13, 'Glue Stick (Pritt)', '1'),
  ('2_6', 24, 'stationery', 14, 'Sharpener', '1')
) as item(template_key, available_from_months, category, display_order, item_name, quantity)
on conflict (school_id, template_key, category, item_name) do nothing;
