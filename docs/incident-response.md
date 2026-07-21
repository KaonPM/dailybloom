# DailyBloom production incident response

Use this guide when DailyBloom is unavailable, leaking data across schools, losing data, or failing a critical workflow.

## Severity

- **Critical:** suspected data exposure, cross-school access, destructive data loss, widespread login failure or the live application is unavailable.
- **High:** a core workflow is broken for many users, but data isolation and the rest of the service remain intact.
- **Normal:** limited defect with a safe workaround and no security or data-loss risk.

## First response

1. Record when the issue began, who reported it, affected roles/routes and screenshots without personal information.
2. For suspected privacy exposure, stop sharing screenshots and restrict investigation to authorised people.
3. Check `/api/health`, Vercel deployment status and runtime logs.
4. Check Supabase service status and relevant logs.
5. Identify the current Vercel deployment and Git commit.
6. Decide whether the cause is application code, database state, provider outage or an unknown condition.

## Containment

- Roll back the application when the current deployment caused the problem.
- Do not reverse SQL or restore a database until the affected data and recovery point are understood.
- Rotate exposed credentials immediately.
- Preserve failing deployment details, logs and backup files.
- Keep parents and schools informed using plain language; do not speculate about cause or expose another person's data.

## Recovery and closure

1. Apply the appropriate deployment rollback or controlled database recovery runbook.
2. Verify staff login, parent login, school isolation and the affected workflow.
3. Monitor for recurrence.
4. Document the cause, impact, timeline, corrective action and prevention.
5. Add an automated test when the incident exposed a reproducible software defect.

## Incident record template

```text
Incident title:
Start/end time (SAST):
Severity:
Reported by:
Affected users/schools/workflows:
Personal data involved: no / suspected / confirmed
Current deployment and commit:
Symptoms:
Containment:
Rollback or recovery performed:
Validation completed:
Root cause:
Corrective action:
Preventive test or control:
Owner and follow-up date:
```
