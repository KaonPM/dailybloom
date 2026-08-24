create table if not exists public.school_data_migrations (
  id uuid primary key default gen_random_uuid(),
  school_id bigint not null references public.schools(id) on delete cascade,
  source_name text not null,
  status text not null default 'validated' check (status in ('validated', 'imported', 'expired')),
  source_rows jsonb not null default '[]'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  exceptions jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists school_data_migrations_school_created_idx
  on public.school_data_migrations (school_id, created_at desc);

alter table public.school_data_migrations enable row level security;
-- Migration data is handled only through authorised server routes.
