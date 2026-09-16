-- Permanently remove the retired Contract 2026 requirement entries.
-- Historical learner uploads are retained.
begin;

delete from public.school_enrolment_document_requirements
where lower(regexp_replace(trim(title), '\s+', ' ', 'g')) = 'contract 2026';

delete from public.classroom_requirement_items
where category = 'Document'
  and lower(regexp_replace(trim(item_name), '\s+', ' ', 'g')) = 'contract 2026';

commit;
