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

## Backup restoration exercise

Before Phase 2 production release, restore the latest Supabase backup into an isolated recovery project. Verify school, learner, membership, report, message, and incident counts without exposing the recovered environment publicly.
