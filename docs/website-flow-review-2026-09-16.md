# Existing website flow review — 16 September 2026

## Scope and conclusion

Reliability review of the existing application, with no new product modules. The application builds successfully and the available library tests pass. This is not a certification that every production workflow works: no staging database or test accounts are available, as confirmed by the owner. Real learner records, external messages, payments and production Storage were not mutated for testing.

## Defects corrected locally

- **Classroom learner-document upload:** the requirements page sent multipart data to an API that expects the signed-upload JSON protocol. It now prepares a signed upload, transfers the file, and completes the document record. Failed requests clear the busy state and display an error.
- **Learner-document deletion:** legacy documents stored their location in `file_url`; deletion only considered `file_path`, leaving those files in Storage. Deletion now resolves both formats, validates the project/bucket/school, removes the stored file before deleting the database record, and reports Storage failures.
- **Printable-document deletion:** Storage failures were ignored and the database record was removed anyway. Failed Storage deletion now stops the operation and displays the error.
- **Compliance forms:** inspections, corrective actions and certificates used `event.currentTarget` after an asynchronous save. They now retain the form element before awaiting, allowing reset and post-save navigation to complete.
- **Attendance entry:** the browser regression check reproduced a signed-out visitor seeing an empty attendance page. The page now redirects to login and uses the shared school-context resolver for master-selected schools.
- **Learner requirements:** classroom-specific digital contract entries are excluded from the upload list, extending the earlier contract retirement change.
- **Verification coverage:** `npm test` now runs every existing library test file, including compliance, learner duplicate detection, workbook selection and security audit tests that the previous command omitted. The authenticated upload-permission probe now uses the actual JSON API contract.

## Verification evidence

- All 94 library tests pass, including two new storage-path regression tests.
- Final production build and TypeScript passed after all fixes, including Attendance.
- Full lint baseline: zero errors, 112 warnings. Changed document/compliance files passed an additional error-only lint run.
- All eight public Chromium tests passed: homepage login links, staff login, parent login/recovery entry points, parent API session denial, cron authorization denial, health response, mobile login layout and core signed-out module entry.
- Mobile staff and parent login pages fit a 390-pixel viewport.
- Added a browser regression that checks signed-out navigation and browser errors across dashboard, learners, classrooms, attendance, payments, progress reports, learner requirements and printable documents. Its initial run found the Attendance defect above; the final rerun passed across all eight routes.
- Four authenticated browser tests were skipped because `E2E_SUPABASE_*` is not configured. They must use isolated sample data, never production.
- Each public browser assertion reported a pass, but the Windows Playwright processes remained running during teardown after their test results. They were interrupted after results were collected; a clean end-to-end runner exit was not verified.

## Module coverage and remaining verification

Every application route was included in the production compilation. Compilation does not verify database schema, RLS, persisted writes, external delivery or user permissions at runtime.

| Existing area | Evidence obtained | Still needs a signed-in sample-data run |
| --- | --- | --- |
| Staff/parent login, recovery and access | Public login checks; authorization/session unit tests; mobile layout | Real login, reset email/PIN delivery, logout and role destinations |
| Master, school setup, delegated admins and practitioners | Permission, role-management and navigation mapping tests; compilation | School selection, invitations, role edits and restricted menus |
| Learners, classrooms, enrolment and re-enrolment | Duplicate/document helpers; upload protocol inspection; compilation | Create/edit enrolment, digital submission, placement and re-enrolment completion |
| Attendance and practitioner attendance | Attendance entry defect reproduced and corrected; compilation | Save, reload, historical attendance, classroom isolation and export |
| Requirements and documents | Upload/deletion defects corrected; path regression tests | Real signed upload, replacement, download, deletion and quantities |
| Activities, Grade R workbooks and homework | Activity date and workbook selection/page tests | Assign, complete and inspect parent workbook/homework views |
| Assessments, progress reports, awards and support | Report definitions/rating and award unit tests | Save/review/publish, print/PDF and learner support history |
| Learner fees, payments, statements and school billing | Allocation, credit and statement unit tests | Record payment, receipts, reconciliation, invoice generation and exports |
| Messages, broadcasts, summaries, events and communications | Event date and WhatsApp formatting tests; unauthorized cron rejection | Staff/parent conversation, attachments, delivery and scheduled execution |
| Incidents and parent permissions | Parent-session rejection; compilation | Incident lifecycle, attachments, approval and consent response |
| School administration | Compilation and form-source inspection | Meeting agenda/minutes, surveys and parent responses |
| DBE compliance, staff compliance, inspections and certificates | Compliance/status/renewal/audit tests; three form fixes | Create/save/reopen/verify, evidence uploads and audit history |
| Dashboards, analytics, reports and data migration | Compilation; error-monitoring tests | Correct totals, filters, exports and controlled sample import |

## Operational limits

- Changes are local; no commit, deployment or production migration was performed during this review.
- Local builds/browser tests use placeholder service configuration; they cannot establish production integration health.
- Existing lint warnings remain an enhancement backlog, not evidence that each warning is a runtime defect.
- Storage and database deletion are separate operations. If file removal succeeds but record deletion fails, retry the deletion; these services cannot be committed in one database transaction.
- Prior contract cleanup scripts/migrations remain separate work from this review and were not executed here.
