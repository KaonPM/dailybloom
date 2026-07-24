-- Allow the delegated roles introduced by the authorization foundation.
-- Existing principal, teacher and master profiles remain valid.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (
    role in (
      'owner',
      'principal',
      'admin',
      'teacher',
      'master',
      'master_admin'
    )
  );

