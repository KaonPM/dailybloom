# DailyBloom backup and recovery runbook

DailyBloom currently uses the Supabase Free plan. Free projects should not rely on paid daily backups or point-in-time recovery. Supabase recommends regularly exporting Free-plan data with `supabase db dump` and keeping the files off-site.

## What must be backed up

A complete recovery set has separate parts:

1. Database roles.
2. Database schema, functions, policies and triggers.
3. Database table data.
4. Supabase Storage files, separately from database metadata.
5. GitHub source code and `supabase/migrations`.
6. A secure inventory of Vercel and Supabase environment-variable names. Secret values must remain in the providers' secret stores or an approved password manager, never in Git or a backup folder.

Database dumps do not contain the actual files stored through Supabase Storage. A database restore alone is therefore not a complete Storage recovery.

## Free-plan backup schedule

- **Weekly:** roles, schema and data logical dumps.
- **Before every database migration:** a fresh logical dump.
- **Monthly:** export or independently copy Storage objects.
- **Quarterly:** perform a recovery rehearsal when an isolated destination is available.
- Keep at least the latest four weekly sets and the latest three monthly Storage sets, subject to privacy and available secure storage.

## Prepare a manual logical backup

Requirements: Docker Desktop, the Supabase CLI, sufficient encrypted disk space, and the database password. Obtain the database connection string from Supabase **Connect**. Do not paste the password into chat, documentation, Git commits or screenshots.

From a private backup folder outside the Git repository, replace the placeholder connection string and run:

```powershell
supabase db dump --db-url "[CONNECTION_STRING]" -f roles.sql --role-only
supabase db dump --db-url "[CONNECTION_STRING]" -f schema.sql
supabase db dump --db-url "[CONNECTION_STRING]" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

Then:

1. Confirm all three files exist and are not empty.
2. Record the date, project reference, production commit and migration state in `backup-manifest.txt`.
3. Encrypt the backup set.
4. Copy the encrypted set to a second private location not dependent on the DailyBloom workspace or OneDrive sync alone.
5. Never commit the dump files.

## Storage backup

Database dumps preserve Storage metadata, not the underlying objects. Export every bucket and retain its bucket/path structure. At minimum record:

- bucket name;
- object path;
- byte size;
- export date;
- total object count.

Because learner documents can contain personal information, Storage backups must be encrypted and access restricted to the release owner or an explicitly authorised recovery operator.

## Recovery choices with both free project slots occupied

- **Routine safety:** create and verify backups without restoring them. This uses no additional Supabase project.
- **Recovery rehearsal:** restore into a local Supabase stack, if the computer has enough resources. Never expose it publicly and use it only for verification.
- **Real disaster:** preserve all backup files first, then decide which existing project can safely be replaced or temporarily upgraded. Do not overwrite either live project during a rehearsal.

## Restore procedure

Restoration is a controlled maintenance operation. Never restore directly over production merely to test a backup.

1. Declare an incident and prevent further writes if continued writes would worsen data loss.
2. Identify the most recent valid backup made before the incident.
3. Record the expected recovery point and the data that may be lost after it.
4. Prepare an isolated local or replacement Supabase destination.
5. Follow Supabase's current **Backup and Restore using the CLI** instructions to restore roles, schema and data in the documented order.
6. Restore Storage objects separately while preserving bucket names and paths.
7. Reconfigure secrets, Auth settings, redirects, email/SMS providers, webhooks, scheduled functions and environment variables. Dumps do not prove these platform settings were restored.
8. Validate the recovery checklist below before any traffic is directed to it.
9. Rotate any credential that may have been exposed during the incident.
10. Record the recovery result and retain the original backup unchanged.

## Recovery validation checklist

- School count and representative school records.
- Staff profiles, memberships and roles.
- Classroom and learner counts per school.
- Parent access remains limited to linked learners.
- Attendance records.
- Messages and notifications.
- Incident reports and acknowledgements.
- Learner requirements and document metadata.
- Grade RR and developmental reports.
- Achievement awards.
- Storage bucket and object counts.
- Row-level security and cross-school isolation tests.
- Staff and parent login using designated test accounts.

## Backup manifest template

```text
Backup date/time (SAST):
Operator:
Supabase project reference:
Production commit SHA:
Roles file and size:
Schema file and size:
Data file and size:
Storage export location and object count:
Encryption confirmed: yes / no
Second copy confirmed: yes / no
Restore test date/result: not yet tested / details
Notes:
```

## Official references

- [Supabase: Database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase: Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase CLI: `db dump`](https://supabase.com/docs/reference/cli/supabase-db-dump)
