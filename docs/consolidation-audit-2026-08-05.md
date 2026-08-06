# DailyBloom consolidation audit - 2026-08-05/06

## Scope and safety baseline

- Authoritative working copy: `C:\Users\kseta\OneDrive\Documents\DailyBloom 2`
- Legacy working copy (read-only): `C:\Users\kseta\dailybloom`
- Authoritative repository: `https://github.com/KaonPM/dailybloom.git`
- Safety branch: `consolidate-dailybloom-folders`
- Authoritative starting commit: `7242555c20f36cf53f7e23f44ae8d98735a6158e` - `Separate school administrator message contacts`
- Legacy commit inspected: `5608fc27aa8ff45397064dd70ae192ca5d4fbed6`

Only the authoritative working copy was changed. The legacy folder was inspected without copying configuration, environment files, generated output, or whole directories. Neither project root was deleted, renamed, moved, overwritten, or merged into the other.

No production deployment was triggered, no migration was applied, and no change was pushed directly to `main` during this audit. Environment-variable values and provider credentials were excluded from the comparison and are not recorded here.

## Working-folder relevance review

The project root was reviewed so that application routes remain under `app/` and the working folder does not retain duplicate page drafts or generated document/render output.

| Item | Decision | Reason |
| --- | --- | --- |
| `app/`, `public/`, `scripts/`, `supabase/`, `tests/` | Retained | Active application source, assets, scripts, migrations, and test coverage. |
| `.github/` | Retained | CI and repository automation. |
| `package.json`, lockfile, Next.js/TypeScript/ESLint/Playwright/Vercel config | Retained | Required project and validation configuration. |
| `AGENTS.md`, `CLAUDE.md` | Retained | Repository development instructions, not application pages. |
| `README.md`, `docs/` | Retained | Project and operational documentation. |
| `supabase-incident-reports.sql` | Retained | Tracked historical schema bootstrap that creates the base incident-report structure used by later migrations. |
| `node_modules/`, `next-env.d.ts` | Retained locally and ignored | Local dependencies and Next.js-generated typing support. They are not application pages or staged source changes. |
| `.next/`, `test-results/`, `tsconfig.tsbuildinfo` | Removed after validation | Generated build/test/cache output; reproducible and not source. |
| `.codex-work/`, `deliverables/`, `output/`, `tmp/` | Removed | Local document/render/cache output unrelated to the running app. |
| `*.updated.page.tsx` at repository root | Removed | Superseded draft copies. Current, routable pages already exist under `app/`. |
| `.agents/` | Retained | Currently empty, but reserved for repository/agent instructions and therefore not treated as disposable generated output. |

The following obsolete root drafts were checked against their live routes before removal:

- `children-id.updated.page.tsx`
- `classrooms.updated.page.tsx`
- `learner-requirements.updated.page.tsx`
- `progress-reports.updated.page.tsx`

The live `app/` versions were newer and contained the active functionality. The removed drafts were untracked duplicates and were not imported into the application.

## Authoritative-versus-legacy comparison

Generated folders, dependencies, Git metadata, caches, and environment files were excluded. The source comparison found:

- 145 paths shared by both folders.
- 112 shared paths with different content.
- 160 paths present only in the authoritative current folder.
- 2 source artifacts present only in the legacy folder after excluding its local environment file.

| Legacy-only artifact | Decision | Reason |
| --- | --- | --- |
| `app/lib/award-certificate.ts` | Not copied | The current annual Achievement Awards module contains the active certificate and issuance workflow. Copying the legacy helper would restore an older parallel implementation. |
| `supabase-award-nominations.sql` | Not copied | It represents the earlier award model and does not meet the current tenant, authorization, audit, and migration-safety requirements. |

No whole-file legacy replacement was used. Relevant Achievement Awards intent was implemented against the current code and schema model.

## Achievement Awards consolidation

- Achievement Awards is a dedicated annual workflow, separate from Progress Reports.
- Practitioners nominate learners only for their active school/class context.
- Owners and principals can review nominations.
- A school administrator can review only when delegated `awards.manage` permission.
- Master/platform roles are not granted school award-management authority.
- Approval and certificate issuance remain separate auditable actions.
- Declines require a reason visible to the practitioner.
- Only issued awards can produce a certificate; revoke and reprint actions use secured RPCs.
- The old hidden award UI, direct database writes, and certificate logic were removed from Progress Reports.
- Sidebar placement follows the role-specific school workflow without duplicating the old Progress Reports entry.

## Prepared Supabase migration

`supabase/migrations/20260806_secure_annual_achievement_awards.sql` is prepared but was not applied.

The migration:

- uses school-scoped role and permission checks;
- restricts nomination to active practitioner membership;
- routes mutations through explicitly granted authenticated RPCs;
- revokes unsafe public/anonymous execution;
- adds annual fields and validation without destructive table replacement;
- uses `NOT VALID` foreign keys where historical data may require later validation;
- prevents new duplicate annual nominations without deleting historical records;
- preserves auditable review, issue, revoke, and reprint metadata.

It must be reviewed and applied through the normal Supabase migration process before the new award actions are exercised in production.

## Validation results

| Check | Result | Notes |
| --- | --- | --- |
| Targeted lint for changed application files | Passed | No errors or warnings in the changed award, sidebar, or progress-report files. |
| Repository lint | Passed | `npm.cmd run lint -- --quiet` |
| TypeScript | Passed | `npm.cmd run typecheck` |
| Production build | Passed | Built with non-secret placeholder environment values because this local workspace has no runtime Supabase URL. All 113 routes compiled. Dynamic cookie-based parent routes emitted expected dynamic-render notices but did not fail the build. |
| Unit/security test suite | Passed | 53 tests passed, including authorization, monitoring, classroom activity, parent event, Achievement Awards, learner document, progress report, and billing coverage. |
| Public Playwright suite | Passed | 6 tests passed. |
| Authenticated Playwright suite | Not run | 4 tests were skipped because no isolated `E2E_SUPABASE_*` test stack is configured. Production Supabase was not used. This remains a pre-merge preview gate. |

No validation command wrote to the production database or deployed the application.

## Preview, merge, and rollback checklist

Before merging:

1. Apply the prepared migration to an approved non-production or controlled environment.
2. Configure an isolated E2E Supabase test stack and run the four authenticated Playwright tests.
3. Open a Vercel Preview for the branch and test practitioner nomination, principal/admin review, decline reason, approval, issue, revoke, reprint, sidebar access, and cross-school isolation.
4. Confirm existing Progress Reports remain unchanged apart from removal of the obsolete awards implementation.
5. Review the branch diff and migration in a pull request before merging to `main`.

Rollback:

1. Before merge, close the pull request or abandon the safety branch; `main` remains untouched.
2. After merge, use a new Git revert commit rather than a destructive reset.
3. If the database migration has been applied, use a reviewed forward migration for database rollback; do not delete historical award records or audit metadata.
4. Keep both local project folders until preview, merge, production verification, and backup confirmation are complete.
