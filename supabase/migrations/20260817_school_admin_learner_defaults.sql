-- School-wide learner document and requirement defaults. Existing school
-- configuration is preserved; these lists are inserted only when none exists.
insert into public.school_enrolment_document_requirements (school_id, title, instructions, is_required, display_order)
select school.id, item.title, item.instructions, true, item.display_order
from public.schools school cross join (values
  (1, 'Birth Certificate', 'Upload a clear copy of the learner''s birth certificate or identity document.'),
  (2, 'Immunisation / Clinic Card', 'Upload the learner''s most recent immunisation or clinic card.'),
  (3, 'Parent/Guardian ID', 'Upload an identity document for the responsible parent or guardian.'),
  (4, 'Signed Parent/Guardian Enrolment Contract', 'Upload the signed enrolment contract where applicable.')
) as item(display_order, title, instructions)
where not exists (select 1 from public.school_enrolment_document_requirements configured where configured.school_id = school.id);

insert into public.school_enrolment_requirement_templates (school_id, category, item_name, quantity, is_required, display_order)
select school.id, item.category, item.item_name, item.quantity, true, item.display_order
from public.schools school cross join (values
  (1, 'hygiene', 'Toilet Rolls', '10'),
  (2, 'hygiene', 'Tissue Box', '3'),
  (3, 'hygiene', 'Wipes (80 per pack)', '6'),
  (4, 'hygiene', 'Big Vaseline', '3'),
  (5, 'hygiene', 'Lifebuoy Soap / Sunlight Bar Soap', '4'),
  (6, 'stationery', 'Flip File (20 pages)', '1'),
  (7, 'stationery', 'College Book Exercise (72 pages)', '1'),
  (8, 'stationery', 'Colouring Book', '1'),
  (9, 'stationery', 'Typek', '1'),
  (10, 'stationery', 'Wax Crayons (box of 12)', '1'),
  (11, 'stationery', 'Long Pencils', '4'),
  (12, 'stationery', 'Rubber (eraser)', '1'),
  (13, 'stationery', 'Glue Stick (Pritt)', '1'),
  (14, 'stationery', 'Sharpener', '1')
) as item(display_order, category, item_name, quantity)
where not exists (select 1 from public.school_enrolment_requirement_templates configured where configured.school_id = school.id);
