# DailyBloom deployment and rollback runbook

This runbook is for controlled releases from GitHub to Vercel. It does not authorize a production deployment by itself.

## Release roles

- **Release owner:** Kaone (or a specifically delegated DailyBloom administrator).
- **Technical verifier:** confirms GitHub checks and smoke tests.
- **Rollback authority:** the release owner may roll back immediately when the live service is materially broken.

## Before a production release

1. Confirm the release branch contains only approved work.
2. Confirm the **Production confidence** GitHub workflow is green for the exact commit.
3. Record the release commit SHA and the current production deployment URL in the release log.
4. Confirm no unreviewed Supabase migration is required.
5. If a migration is required, create and verify a fresh manual backup before applying it.
6. Test these critical journeys against an isolated environment where available:
   - staff login;
   - parent login and learner selection;
   - school and classroom isolation;
   - attendance;
   - parent messaging;
   - incident reporting and parent acknowledgement;
   - learner requirements;
   - progress-report submission and principal review.
7. Obtain explicit release-owner approval before merging to `main`.

## Release procedure

1. Merge the approved branch into `main` without bypassing required GitHub checks.
2. Open Vercel **Deployments** and locate the deployment for the recorded commit SHA.
3. Wait for the deployment to reach **Ready**. Do not promote a failed or cancelled build.
4. Confirm `https://www.dailybloom.co.za/api/health` returns `status: ok`.
5. Perform the short production smoke test below.
6. Record the deployment URL, commit SHA, release time, verifier and result.

## Five-minute production smoke test

- Open the homepage and staff login.
- Sign in using a designated test staff account and confirm the correct school.
- Open one read-only dashboard or report page.
- Sign out.
- Sign in using a designated parent test account, select its learner and open the dashboard.
- Confirm another school or learner cannot be accessed.
- Check Vercel runtime logs for a new cluster of errors.

Do not create, edit or delete real learner records merely to test a release.

## When to roll back

Roll back when the release causes a critical regression such as failed login, cross-school exposure, unavailable parent access, widespread server errors, or broken core submission workflows. A cosmetic issue that has a safe workaround can normally be fixed through the next controlled release.

## Application rollback in Vercel

1. Record the failing deployment URL, commit SHA, time and symptoms.
2. Open Vercel **Deployments**, filter to the production branch and find the immediately previous known-good production deployment.
3. Use its menu to select **Instant Rollback**, then confirm.
4. On Vercel Hobby, rollback is limited to the immediately previous production deployment.
5. Verify the homepage, `/api/health`, staff login and parent login.
6. Check that production errors have stopped.
7. Do not delete the failed deployment; it is evidence for diagnosis.
8. Create and test a corrective commit on a branch before releasing again.

Important: a Vercel rollback changes application code and routing. It does **not** undo database writes or safely reverse a Supabase migration. It can also restore the earlier deployment's cron configuration and build-time environment snapshot.

## After an Instant Rollback

Vercel may stop automatically assigning production domains after a rollback. When the corrected deployment has passed verification, use **Promote to Production** for the approved deployment and confirm that normal production assignment is restored.

## Release log template

```text
Date/time (SAST):
Release owner:
Verifier:
Commit SHA:
Vercel deployment URL:
Database migration(s): none / list
Backup reference: not required / path and timestamp
GitHub workflow: passed / URL
Smoke test: passed / failed
Rollback required: no / yes
Notes:
```

## Official references

- [Vercel: Rolling back a production deployment](https://vercel.com/docs/deployments/rollback-production-deployment)
- [Vercel: Instant Rollback](https://vercel.com/docs/instant-rollback)
- [Vercel: Promoting deployments](https://vercel.com/docs/deployments/promoting-a-deployment)
