-- Phase 3 delegated platform access.
-- This migration intentionally grants read access only. Sensitive changes continue
-- through server-authorized API routes so a delegated user cannot bypass the
-- permission checklist with a direct browser/database request.

create or replace function public.current_platform_has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_user_roles role_assignment
    where role_assignment.user_id = auth.uid()
      and role_assignment.status = 'active'
      and (
        role_assignment.role = 'master'
        or (
          role_assignment.role = 'master_admin'
          and required_permission = any(coalesce(role_assignment.permissions, '{}'::text[]))
        )
      )
  );
$$;

revoke all on function public.current_platform_has_permission(text) from public;
grant execute on function public.current_platform_has_permission(text) to authenticated;

drop policy if exists "Delegated platform school read" on public.schools;
create policy "Delegated platform school read"
on public.schools for select to authenticated
using (
  public.current_platform_has_permission('platform.schools.onboard')
  or public.current_platform_has_permission('platform.schools.status')
  or public.current_platform_has_permission('platform.principals.manage')
  or public.current_platform_has_permission('billing.manage')
);

drop policy if exists "Delegated onboarding request read" on public.principal_requests;
create policy "Delegated onboarding request read"
on public.principal_requests for select to authenticated
using (public.current_platform_has_permission('platform.schools.onboard'));

drop policy if exists "Delegated school onboarding read" on public.school_onboarding;
create policy "Delegated school onboarding read"
on public.school_onboarding for select to authenticated
using (public.current_platform_has_permission('platform.schools.onboard'));

drop policy if exists "Delegated principal profile read" on public.profiles;
create policy "Delegated principal profile read"
on public.profiles for select to authenticated
using (
  (
    public.current_platform_has_permission('platform.principals.manage')
    or public.current_platform_has_permission('platform.schools.onboard')
    or public.current_platform_has_permission('platform.schools.status')
    or public.current_platform_has_permission('billing.manage')
  )
  and role in ('owner', 'principal')
);

drop policy if exists "Delegated subscription read" on public.school_subscriptions;
create policy "Delegated subscription read"
on public.school_subscriptions for select to authenticated
using (public.current_platform_has_permission('billing.manage'));

drop policy if exists "Delegated subscription payment read" on public.subscription_payments;
create policy "Delegated subscription payment read"
on public.subscription_payments for select to authenticated
using (public.current_platform_has_permission('billing.manage'));

comment on function public.current_platform_has_permission(text) is
  'Checks an active platform role and its explicit delegated permission list without weakening table-level RLS.';
