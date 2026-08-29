-- These are links to DailyBloom's existing Grade R activity library, grouped
-- for planning purposes. They are not DBE workbook copies.
with collections (title, learning_area, term, topic) as (
  values
    ('Grade R Mathematics activity collection — Term 1', 'Mathematics', 1, 'Number, operations and relationships'),
    ('Grade R Mathematics activity collection — Term 2', 'Mathematics', 2, 'Patterns, functions and algebra'),
    ('Grade R Mathematics activity collection — Term 3', 'Mathematics', 3, 'Space and shape; measurement'),
    ('Grade R Mathematics activity collection — Term 4', 'Mathematics', 4, 'Data handling and consolidation'),
    ('Grade R Life Skills activity collection — Term 1', 'Life Skills', 1, 'Beginning knowledge and personal well-being'),
    ('Grade R Life Skills activity collection — Term 2', 'Life Skills', 2, 'Creative arts and physical education'),
    ('Grade R Life Skills activity collection — Term 3', 'Life Skills', 3, 'Beginning knowledge and community'),
    ('Grade R Life Skills activity collection — Term 4', 'Life Skills', 4, 'Personal well-being and consolidation')
)
insert into public.learning_resources (
  title, description, grade, resource_type, source_name, language, academic_year,
  term, learning_area, topic, content_rights, is_downloadable, is_printable,
  is_parent_shareable, status
)
select
  collections.title,
  'Use the Grade R-aligned activities already available in Classroom Activities.',
  'Grade R', 'Activity Collection', 'DailyBloom', 'English', 2026,
  collections.term, collections.learning_area, collections.topic,
  'DailyBloom original', false, true, true, 'published'
from collections
where not exists (
  select 1 from public.learning_resources existing
  where existing.school_id is null
    and existing.title = collections.title
    and existing.academic_year = 2026
);
