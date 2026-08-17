-- Add missing universal enrolment terms without changing or deleting any
-- school-created or previously edited section.
insert into public.school_enrolment_terms_sections
  (school_id, title, content, is_active, display_order)
select school.id, term.title, term.content, true, term.display_order
from public.schools school
cross join (values
  (1, 'Learner Information and Enrolment', 'The parent or legal guardian confirms that the learner information supplied is accurate and agrees to notify the school promptly of any changes.'),
  (2, 'Health, Safety and Emergency Care', 'The parent or legal guardian must disclose information reasonably required for the safe care of the learner, including medical conditions, allergies, medication and emergency contact information.'),
  (3, 'Fees and Payment Obligations', 'The parent or legal guardian agrees to pay applicable school fees and charges according to the school''s current fee structure and payment terms.'),
  (4, 'Registration Fee', 'Add this school''s registration-fee terms, including any applicable refund or transfer arrangements.'),
  (5, 'Operating Hours and Collection', 'The parent or legal guardian agrees to observe the school''s operating hours and collection arrangements, including any applicable late collection rules.'),
  (6, 'Late Collection', 'Add this school''s late collection policy, including any grace period or charges where applicable.'),
  (7, 'Aftercare', 'Add this school''s aftercare conditions, availability, collection arrangements and charges where applicable.'),
  (8, 'Illness and Attendance', 'A learner who is ill, has a contagious condition, or presents a health risk to others may be required to remain at home in accordance with the school''s health procedures.'),
  (9, 'Medication', 'Parents or legal guardians must provide the school with relevant information and instructions regarding medication required by the learner.'),
  (10, 'Personal Belongings', 'Personal belongings brought to school should be clearly marked with the learner''s name. The school may apply its own rules regarding responsibility for lost or damaged items.'),
  (11, 'Notice and Withdrawal', 'The parent or legal guardian agrees to comply with the school''s applicable notice requirements when withdrawing the learner.'),
  (12, 'Refunds', 'Add this school''s refund policy and any conditions that apply.'),
  (13, 'Information Updates', 'The parent or legal guardian must inform the school when important learner, parent, guardian, medical, address or contact information changes.'),
  (14, 'Parent Declaration', 'I confirm that the information provided in this enrolment application is true and complete to the best of my knowledge and that I have read and accepted the applicable school terms and requirements.')
) as term(display_order, title, content)
where not exists (
  select 1 from public.school_enrolment_terms_sections existing
  where existing.school_id = school.id
    and lower(trim(existing.title)) = lower(trim(term.title))
);
