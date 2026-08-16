-- Editable starter wording for schools that have not added enrolment terms yet.
-- Schools remain responsible for approving wording against their own policies and
-- applicable DBE and provincial requirements before opening enrolments.
insert into public.school_enrolment_terms_sections (school_id, title, content, display_order)
select schools.id, starter.title, starter.content, starter.display_order
from public.schools schools
cross join (
  values
    (1, 'Learner information and enrolment', 'The parent or legal guardian confirms that the learner information supplied is accurate and agrees to notify the school promptly of any changes.'),
    (2, 'Health, safety and emergency care', 'The parent or legal guardian must disclose information needed to support the learner safely, keep emergency contacts current, and authorises reasonable emergency action when the school cannot reach a responsible adult.'),
    (3, 'Fees, attendance and school rules', 'The parent or legal guardian agrees to the school fee arrangement, attendance expectations and school policies provided by the school. The school will communicate material policy or fee changes in writing.'),
    (4, 'Privacy and records', 'The school will use learner and parent information for enrolment, care, education, communication, administration and lawful record-keeping. The parent or legal guardian may ask the school about the information it holds and request corrections where appropriate.')
) as starter(display_order, title, content)
where not exists (
  select 1 from public.school_enrolment_terms_sections terms where terms.school_id = schools.id
);
