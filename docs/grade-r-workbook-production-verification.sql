-- Read-only post-migration verification for the Grade R DBE Workbook Library.
-- This query does not insert, update, delete, upload, or expose school/user data.

with checks as (
  select 10 as sort_order, 'workbook_columns'::text as check_name,
    jsonb_agg(jsonb_build_object(
      'column', column_name,
      'type', data_type,
      'nullable', is_nullable,
      'default', column_default
    ) order by ordinal_position) as details
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'learning_resources'
    and column_name = any(array[
      'book_number', 'learning_areas', 'official_source_url', 'storage_path',
      'file_type', 'checksum', 'version', 'published_date', 'catalogue_status'
    ])

  union all
  select 20, 'year_management_columns',
    coalesce(jsonb_agg(jsonb_build_object(
      'column', column_name,
      'type', data_type,
      'nullable', is_nullable,
      'default', column_default
    ) order by ordinal_position), '[]'::jsonb)
  from information_schema.columns
  where table_schema = 'public' and table_name = 'learning_resource_years'

  union all
  select 30, 'activity_link_columns',
    coalesce(jsonb_agg(jsonb_build_object(
      'column', column_name,
      'type', data_type,
      'nullable', is_nullable
    ) order by ordinal_position), '[]'::jsonb)
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'activity_learning_resources'
    and column_name = any(array['school_id', 'classroom_id', 'selected_pages', 'created_by'])

  union all
  select 40, 'homework_link_columns',
    coalesce(jsonb_agg(jsonb_build_object(
      'column', column_name,
      'type', data_type,
      'nullable', is_nullable
    ) order by ordinal_position), '[]'::jsonb)
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'homework_learning_resources'
    and column_name = any(array['school_id', 'classroom_id', 'selected_pages', 'created_by'])

  union all
  select 50, 'rls_state',
    coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity
    ) order by c.relname), '[]'::jsonb)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array[
      'learning_resources', 'learning_resource_years',
      'learning_resource_file_history', 'activity_learning_resources',
      'homework_learning_resources'
    ])

  union all
  select 60, 'workbook_rls_policies',
    coalesce(jsonb_agg(jsonb_build_object(
      'schema', schemaname,
      'table', tablename,
      'policy', policyname,
      'roles', roles,
      'command', cmd,
      'using', qual,
      'check', with_check
    ) order by schemaname, tablename, policyname), '[]'::jsonb)
  from pg_policies
  where (schemaname = 'public' and tablename = any(array[
      'learning_resources', 'learning_resource_years',
      'learning_resource_file_history', 'activity_learning_resources',
      'homework_learning_resources'
    ]))
    or (schemaname = 'storage' and tablename = 'objects'
      and coalesce(qual, '') ilike '%dbe-workbooks%'
      or schemaname = 'storage' and tablename = 'objects'
      and coalesce(with_check, '') ilike '%dbe-workbooks%')

  union all
  select 70, 'indexes',
    coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename,
      'index', indexname,
      'definition', indexdef
    ) order by tablename, indexname), '[]'::jsonb)
  from pg_indexes
  where schemaname = 'public'
    and tablename = any(array[
      'learning_resources', 'learning_resource_years',
      'learning_resource_file_history', 'activity_learning_resources',
      'homework_learning_resources'
    ])
    and (indexname ilike '%workbook%' or indexname ilike '%resource_year%'
      or indexname ilike '%learning_resources_school%')

  union all
  select 80, 'foreign_keys',
    coalesce(jsonb_agg(jsonb_build_object(
      'table', conrelid::regclass::text,
      'constraint', conname,
      'definition', pg_get_constraintdef(oid)
    ) order by conrelid::regclass::text, conname), '[]'::jsonb)
  from pg_constraint
  where contype = 'f'
    and connamespace = 'public'::regnamespace
    and conrelid::regclass::text = any(array[
      'learning_resource_years', 'learning_resource_file_history',
      'activity_learning_resources', 'homework_learning_resources'
    ])

  union all
  select 90, 'workbook_triggers',
    coalesce(jsonb_agg(jsonb_build_object(
      'table', event_object_table,
      'trigger', trigger_name,
      'timing', action_timing,
      'event', event_manipulation,
      'statement', action_statement
    ) order by event_object_table, trigger_name, event_manipulation), '[]'::jsonb)
  from information_schema.triggers
  where trigger_schema = 'public'
    and trigger_name = any(array[
      'activity_learning_resource_scope',
      'homework_learning_resource_scope',
      'learning_resource_file_history'
    ])

  union all
  select 100, 'workbook_functions',
    coalesce(jsonb_agg(jsonb_build_object(
      'function', p.proname,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'security_definer', p.prosecdef,
      'definition', pg_get_functiondef(p.oid)
    ) order by p.proname), '[]'::jsonb)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(array[
      'validate_learning_resource_link_scope',
      'retain_learning_resource_file_history',
      'set_learning_resource_default_year',
      'review_learning_resource_update',
      'create_workbook_assignment',
      'replace_weekly_activity_plan',
      'replace_classroom_homework'
    ])

  union all
  select 110, 'storage_bucket',
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'public', public,
      'file_size_limit', file_size_limit,
      'allowed_mime_types', allowed_mime_types
    )), '[]'::jsonb)
  from storage.buckets
  where id = 'dbe-workbooks'

  union all
  select 120, 'data_counts', jsonb_build_object(
    'learning_resources', (select count(*) from public.learning_resources),
    'weekly_activity_plans', (select count(*) from public.weekly_activity_plans),
    'homework_assignments', (select count(*) from public.homework_assignments),
    'summaries', (select count(*) from public.summaries),
    'schools', (select count(*) from public.schools),
    'classrooms', (select count(*) from public.classrooms),
    'learners', (select count(*) from public.learners),
    'parent_relationships', (select count(*) from public.parent_access),
    'activity_resource_links', (select count(*) from public.activity_learning_resources),
    'homework_resource_links', (select count(*) from public.homework_learning_resources),
    'workbook_years', (select count(*) from public.learning_resource_years),
    'cached_file_history', (select count(*) from public.learning_resource_file_history),
    'cached_workbook_objects', (select count(*) from storage.objects where bucket_id = 'dbe-workbooks')
  )

  union all
  select 130, 'integrity_failures_should_all_be_zero', jsonb_build_object(
    'activity_target_orphans', (
      select count(*) from public.activity_learning_resources l
      left join public.weekly_activity_plans p on p.id = l.weekly_plan_id
      where p.id is null
    ),
    'activity_resource_orphans', (
      select count(*) from public.activity_learning_resources l
      left join public.learning_resources r on r.id = l.resource_id
      where r.id is null
    ),
    'activity_scope_mismatches', (
      select count(*) from public.activity_learning_resources l
      join public.weekly_activity_plans p on p.id = l.weekly_plan_id
      where l.school_id is distinct from p.school_id
        or l.classroom_id is distinct from p.classroom_id
    ),
    'homework_target_orphans', (
      select count(*) from public.homework_learning_resources l
      left join public.homework_assignments h on h.id = l.homework_assignment_id
      where h.id is null
    ),
    'homework_resource_orphans', (
      select count(*) from public.homework_learning_resources l
      left join public.learning_resources r on r.id = l.resource_id
      where r.id is null
    ),
    'homework_scope_mismatches', (
      select count(*) from public.homework_learning_resources l
      join public.homework_assignments h on h.id = l.homework_assignment_id
      where l.school_id is distinct from h.school_id
        or l.classroom_id is distinct from h.classroom_id
    ),
    'invalid_activity_pages', (
      select count(*) from public.activity_learning_resources l
      left join public.learning_resources r on r.id = l.resource_id
      where exists (select 1 from unnest(l.selected_pages) p where p < 1 or (r.page_count is not null and p > r.page_count))
    ),
    'invalid_homework_pages', (
      select count(*) from public.homework_learning_resources l
      left join public.learning_resources r on r.id = l.resource_id
      where exists (select 1 from unnest(l.selected_pages) p where p < 1 or (r.page_count is not null and p > r.page_count))
    ),
    'multiple_default_grade_r_years', greatest(0, (
      select count(*) from public.learning_resource_years where grade = 'Grade R' and is_default
    ) - 1)
  )
)
select check_name, jsonb_pretty(details) as details
from checks
order by sort_order;
