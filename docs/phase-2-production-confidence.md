# DailyBloom Phase 2: Production Confidence

This work is developed away from `main`. Production remains on the last approved Phase 1 commit until staging checks pass and an approved merge is made.

## Release path

1. Develop on a Phase 2 branch.
2. Run lint, TypeScript, automated tests, and a production build in CI.
3. Deploy the branch to a staging environment with staging-only data and credentials.
4. Complete authorization, cross-school, and critical workflow checks.
5. Obtain release approval.
6. Merge to `main` and verify the production deployment.

## Required test coverage

- API authentication and permission enforcement.
- Cross-school isolation for every school-scoped resource.
- Parent-to-learner relationship isolation.
- Critical end-to-end workflows for Principal, Teacher, and Parent.
- Configurable Preschool Admin and Master Admin permissions before those roles are released.

## Production safeguards

- Never use production credentials in CI.
- Never copy identifiable learner or parent data into staging.
- Apply additive database migrations before destructive changes are considered.
- Record the production commit before every release.
- Treat application rollback and database recovery as separate procedures.

## Rollback outline

1. Stop the rollout and record the failing deployment and symptoms.
2. Redeploy the last verified production commit in Vercel.
3. Do not reverse a database migration until its rollback safety is confirmed.
4. Validate login, school isolation, messaging, reports, incidents, and parent access.
5. Record the incident and corrective action.

Detailed operating guides:

- [Deployment and rollback runbook](deployment-runbook.md)
- [Backup and recovery runbook](backup-and-recovery.md)
- [Production incident response](incident-response.md)
- [Monitoring](monitoring.md)

## Backup restoration exercise

Before Phase 2 production release, create a fresh logical Supabase backup and verify its manifest. Because both free project slots are occupied, a recovery rehearsal may use an isolated local Supabase stack rather than another hosted project. Never overwrite either live project for a rehearsal. Verify school, learner, membership, report, message, incident and Storage counts without exposing the recovered environment publicly.

### Completed rehearsal: 21 July 2026

- Restored `roles.sql`, `schema.sql`, and `data.sql` into a temporary local Supabase stack with stop-on-error and transactional schema/data imports.
- Restore completed without SQL errors: 55 public tables, all 55 with row-level security enabled, 149 public policies, and no unvalidated foreign keys.
- Representative restored counts included 2 schools, 6 school memberships, 4 classrooms, 29 learners, 625 attendance records, 11 messages, 1 incident report, 67 learner document records, 390 stationery checklist records, 3 report periods, and 10 achievement awards.
- Tested row-level isolation as authenticated teachers from both schools. Each account saw only its own school's learners (27 and 2 respectively) and zero learners from the other school.
- Restored all six Storage buckets: 84 objects totalling 759,634,124 bytes. Bucket counts and byte totals matched the backup manifest exactly.
- Downloaded a restored Storage object and confirmed its SHA-256 hash matched the source backup file.
- The local stack was stopped after verification. Neither hosted Supabase project nor production was modified.

Authenticated browser tests are available through `npm run test:e2e:authenticated`. They are opt-in and require `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, and `E2E_SUPABASE_SERVICE_ROLE_KEY` from an isolated local stack. The suite creates temporary Principal, Teacher, and Parent credentials, exercises the real login pages and role destinations, and removes its test records afterwards. Never point this suite at production.

The authenticated suite passed against the restored local stack on 21 July 2026: Principal login reached the Principal Dashboard, Teacher login reached the assigned Teacher Dashboard, and Parent PIN login reached the linked learner dashboard. API probes also confirmed unauthenticated and forged-token denial, same-school access, cross-school denial, parent-to-unrelated-learner denial, claimed-sender impersonation denial, and permission denial for staff creation, platform principal creation, school approval, billing, and learner-document management. Post-test checks confirmed that no temporary authentication users or profiles remained.

## Final Phase 2 review: 21 July 2026

The sensitive API inventory was reviewed route by route. Service-role access is now guarded by one of the following boundaries: staff bearer authentication plus school/permission checks, a validated parent session plus learner relationship checks, or a required cron bearer secret. Public parent login, PIN creation and recovery routes remain intentionally public workflow entry points and retain rate limiting and short-lived workflow state.

The event-reminder scheduler previously allowed execution when `CRON_SECRET` was absent. It now fails closed, matching the SMS reminder scheduler. Browser regression tests confirm that both scheduled endpoints return `401` without cron authorization.

Final validation results:

- ESLint: passed with 0 errors and 137 existing warnings.
- TypeScript: passed.
- Unit tests: 24 passed.
- Production build: passed on Next.js 16.2.10.
- Public browser/API tests: 6 passed.
- Authenticated Principal, Teacher, Parent and sensitive API tests: 4 passed.
- Restored-database RLS isolation, schema integrity, Storage restore and object hash checks: passed.
- Temporary authenticated test data cleanup: 0 test auth users and 0 test profiles remained.

### Readiness assessment

Phase 2's engineering confidence work is complete on the isolated branch. Current production readiness is assessed at **87/100**. This is strong enough for a controlled release process, but it is not a claim that operations are risk-free.

Remaining operational work before or immediately after release:

- Keep a human-approved merge and production smoke-test checkpoint; this branch has not been merged into production automatically.
- Verify live error-monitor routing and that a real alert reaches the responsible person.
- Continue using the restored local Supabase stack as the staging substitute while the free plan has no spare hosted project slot.
- Schedule load/performance testing before onboarding approximately 100 preschools; correctness tests do not measure capacity or latency.
- Reduce the 137 lint warnings as controlled technical-debt work without bundling broad UI rewrites into a release.
- Add the opt-in authenticated suite to a protected CI environment only when isolated non-production Supabase credentials become available.
