-- Catalogue every official 2026 Grade R language edition. Each entry links to
-- the DBE term page where the corresponding official workbook is published.
-- DailyBloom stores references only; it does not copy or alter DBE content.
update public.learning_resources
set
  title = title || ' — English',
  learning_area = 'English Home Language'
where grade = 'Grade R'
  and resource_type = 'DBE Workbook'
  and source_name = 'Department of Basic Education'
  and academic_year = 2026
  and language = 'English'
  and title not like '%—%';

with languages (language, learning_area) as (
  values
    ('Afrikaans', 'Afrikaans First Additional Language'),
    ('English', 'English Home Language'),
    ('IsiNdebele', 'Other Home Languages'),
    ('IsiXhosa', 'Other Home Languages'),
    ('IsiZulu', 'Other Home Languages'),
    ('Sepedi', 'Other Home Languages'),
    ('Sesotho', 'Other Home Languages'),
    ('Setswana', 'Other Home Languages'),
    ('Siswati', 'Other Home Languages'),
    ('Tshivenda', 'Other Home Languages'),
    ('Xitsonga', 'Other Home Languages')
), terms (term, source_url) as (
  values
    (1, 'https://www.education.gov.za/Curriculum/LearningandTeachingSupportMaterials(LTSM)/2026Workbooks1.aspx'),
    (2, 'https://www.education.gov.za/Curriculum/LearningandTeachingSupportMaterials(LTSM)/2026Workbooks1.aspx'),
    (3, 'https://www.education.gov.za/Curriculum/LearningandTeachingSupportMaterials(LTSM)/2026WorkbooksTerm3and4.aspx'),
    (4, 'https://www.education.gov.za/Curriculum/LearningandTeachingSupportMaterials(LTSM)/2026WorkbooksTerm3and4.aspx')
), resources as (
  select
    format('DBE Grade R Workbook Book %s — %s', terms.term, languages.language) as title,
    languages.learning_area,
    languages.language,
    terms.term,
    terms.source_url
  from languages cross join terms
)
insert into public.learning_resources (
  title, grade, resource_type, source_name, source_url, language, academic_year,
  term, learning_area, content_rights, is_downloadable, is_printable,
  is_parent_shareable, status
)
select
  resources.title, 'Grade R', 'DBE Workbook', 'Department of Basic Education',
  resources.source_url, resources.language, 2026, resources.term,
  resources.learning_area, 'DBE State-Owned', true, true, true, 'published'
from resources
where not exists (
  select 1
  from public.learning_resources existing
  where existing.school_id is null
    and existing.title = resources.title
    and existing.language = resources.language
    and existing.academic_year = 2026
);
