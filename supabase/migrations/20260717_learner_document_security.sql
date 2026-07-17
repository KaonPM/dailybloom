alter table public.learner_documents
  add column if not exists file_path text,
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null,
  add column if not exists uploaded_by_name text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists learner_documents_file_path_idx
  on public.learner_documents (file_path)
  where file_path is not null;

insert into storage.buckets (id, name, public)
values ('learner-documents', 'learner-documents', true)
on conflict (id) do nothing;
