-- Enrolment contracts are completed digitally. Retire legacy upload
-- requirements, including the school-specific Contract 2026 label.
-- Keep previously uploaded learner documents as historical records.
update public.school_enrolment_document_requirements
set is_active = false
where lower(regexp_replace(trim(title), '\s+', ' ', 'g')) in (
  'contract 2026', 'contract', 'parent contract', 'enrolment contract',
  'enrollment contract', 'signed enrolment contract',
  'signed parent/guardian enrolment contract'
);

update public.classroom_requirement_items
set is_active = false
where category = 'Document'
  and lower(regexp_replace(trim(item_name), '\s+', ' ', 'g')) in (
    'contract 2026', 'contract', 'parent contract', 'enrolment contract',
    'enrollment contract', 'signed enrolment contract',
    'signed parent/guardian enrolment contract'
  );
