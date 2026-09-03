-- Starter learner-requirement lists. Schools can edit, deactivate or delete
-- any item in School Setup; existing school changes always take precedence.
insert into public.school_enrolment_requirement_templates
  (school_id, template_key, available_from_months, available_to_months, category, item_name, quantity, is_required, display_order)
select school.id, item.template_key, item.from_months, item.to_months, item.category, item.item_name, item.quantity, false, item.display_order
from public.schools school
cross join (values
  ('babies', 0, 24, 'hygiene', 'Face Cloth', '1', 1),
  ('babies', 0, 24, 'hygiene', 'Wipes', '4 packets', 2),
  ('babies', 0, 24, 'hygiene', 'Bath Soap', '4 bars', 3),
  ('babies', 0, 24, 'hygiene', 'Big Tub Vaseline', '1', 4),
  ('babies', 0, 24, 'hygiene', 'Facial Tissue', '2 packets', 5),
  ('babies', 0, 24, 'hygiene', 'Toilet Paper', '12 rolls', 6),
  ('toddlers', 24, 48, 'hygiene', 'Wipes', '4 packets', 1),
  ('toddlers', 24, 48, 'hygiene', 'Toilet Paper', '12 rolls', 2),
  ('toddlers', 24, 48, 'hygiene', 'Facial Tissue', '2 boxes', 3),
  ('toddlers', 24, 48, 'hygiene', 'Big Bottle Vaseline', '1', 4),
  ('toddlers', 24, 48, 'hygiene', 'Washcloth', '1', 5),
  ('toddlers', 24, 48, 'hygiene', 'Sunlight Soap', '4 bars', 6),
  ('toddlers', 24, 48, 'stationery', 'Typek Paper', '250 sheets', 7),
  ('toddlers', 24, 48, 'stationery', 'Pritt Glue', '2', 8),
  ('toddlers', 24, 48, 'stationery', 'Exercise Book', '3', 9),
  ('toddlers', 24, 48, 'stationery', 'Colouring Book', '1', 10),
  ('toddlers', 24, 48, 'stationery', 'Pencils', '12', 11),
  ('toddlers', 24, 48, 'stationery', 'Crayons', '1 packet', 12),
  ('toddlers', 24, 48, 'stationery', 'Eraser', '1', 13),
  ('toddlers', 24, 48, 'stationery', 'Sharpener', '1', 14),
  ('grade_r', 60, 84, 'stationery', 'Exercise Book (72 pages)', '3', 1),
  ('grade_r', 60, 84, 'stationery', 'HB Pencils', '12', 2),
  ('grade_r', 60, 84, 'stationery', 'Black Pens', '2', 3),
  ('grade_r', 60, 84, 'stationery', 'Red Pens', '2', 4),
  ('grade_r', 60, 84, 'stationery', 'Eraser', '2', 5),
  ('grade_r', 60, 84, 'stationery', 'Sharpener', '2', 6),
  ('grade_r', 60, 84, 'stationery', 'Drawing Book', '1', 7),
  ('grade_r', 60, 84, 'stationery', 'Big Pritt Glue', '2', 8),
  ('grade_r', 60, 84, 'stationery', 'Colouring Book', '1', 9),
  ('grade_r', 60, 84, 'stationery', 'Typek Paper', '1 ream', 10),
  ('grade_r', 60, 84, 'stationery', 'Big Wax Crayons', '1 packet', 11),
  ('grade_r', 60, 84, 'hygiene', 'Toilet Paper', '12 rolls', 12),
  ('grade_r', 60, 84, 'hygiene', 'Dish Soap', '4', 13),
  ('grade_r', 60, 84, 'hygiene', 'Big Bottle Vaseline', '1', 14),
  ('grade_r', 60, 84, 'hygiene', 'Washcloth', '1', 15),
  ('grade_r', 60, 84, 'hygiene', 'Wipes', '1 packet', 16),
  ('grade_r', 60, 84, 'hygiene', 'Facial Tissue', '1 box', 17)
) as item(template_key, from_months, to_months, category, item_name, quantity, display_order)
on conflict (school_id, template_key, category, item_name) do nothing;
