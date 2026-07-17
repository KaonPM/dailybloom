alter table public.learner_stationery_checklist
  add column if not exists received_by uuid references auth.users(id) on delete set null,
  add column if not exists received_by_name text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists learner_stationery_school_class_idx
  on public.learner_stationery_checklist (school_id, classroom_id, learner_id);
create index if not exists learner_stationery_learner_item_idx
  on public.learner_stationery_checklist (learner_id, item_name);
create index if not exists learner_documents_school_learner_idx
  on public.learner_documents (school_id, learner_id, document_type);
create index if not exists classroom_requirement_items_active_idx
  on public.classroom_requirement_items (school_id, classroom_id, is_active);
