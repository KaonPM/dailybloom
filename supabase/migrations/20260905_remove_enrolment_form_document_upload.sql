-- The secure enrolment form is completed online (or captured by staff from a
-- paper copy), so it must not appear as a document parents need to upload.
delete from public.school_enrolment_document_requirements
where title = 'Signed Parent/Guardian Enrolment Contract';
