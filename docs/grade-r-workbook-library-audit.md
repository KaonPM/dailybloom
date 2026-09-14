# Grade R Workbook Library audit and operating notes

## Existing foundation retained

- `/grade-r-learning` already provided the Grade R Learning Hub.
- `learning_resources` stored global and school-specific resources.
- `activity_learning_resources` and `homework_learning_resources` already linked resources to the weekly activity planner and homework assignments.
- Classroom Activities, Homework, Parent Homework and Daily Summaries remain the existing workflows. No parallel modules were introduced.
- `school_setup_settings.grade_r_home_language` remains the preferred language source.
- Grade R access continues to depend on an existing Grade R classroom and the established school context and permission helpers.
- The existing annual DBE resource-check cron and Master resource-review queue remain in place.

## Workbook catalogue model

An edition is identified by academic year, Grade R, book/term and language. Home Language, Mathematics and Life Skills are metadata on the same integrated workbook; they are not separate workbook records.

Only editions marked `current` and `published` are available to practitioners. A verified cached PDF, official source and verified page count are required before Master can publish an edition. New years and detected source updates start as `needs_review`. Making a year the default requires at least one published, current, cached edition. Earlier years and cached-file history are retained.

No new workbook URLs are seeded by these changes. Existing source records remain subject to Master review. The official DBE catalogue must be checked at file level before a resource is marked current; a catalogue-page link alone is not treated as a verified PDF.

### 2026 source verification warning

During file-level validation on 14 September 2026, the official catalogue entry labelled "Grade R: Book 1 - English" downloaded a Grade 3 Life Skills English workbook, and the entry labelled "Grade R: Book 1 - Afrikaans" downloaded a Grade 1 Mathematics Afrikaans workbook. Neither file is suitable for the controlled Grade R acceptance record. The existing English URL in the repository must remain `needs_review` and must not be cached or published until DBE supplies or exposes the correctly mapped 2026 Grade R file.

The [official catalogue entry for Grade R Book 3 English](https://www.education.gov.za/LinkClick.aspx?fileticket=MKbh5TfkWpM%3D&forcedownload=true&mid=15010&portalid=0&tabid=5885) was also checked at file level and is suitable for a controlled acceptance record. The downloaded PDF identifies itself as Grade R, English, Book 3, Term 3, 16th Edition; it contains 70 pages and has SHA-256 checksum `0BE86398A10A5EF80DDFDC75DF3FE57260AD4BB825E640C6069B9EDF719ED18C`. This verification does not publish or cache the workbook automatically: Master must still use the normal catalogue workflow and retain the resource in review until the cached file and metadata have been checked in production.

## Storage and document access

The `dbe-workbooks` bucket is private, PDF-only and limited to 100 MiB. There are no public or authenticated `storage.objects` policies for this bucket. Master uploads use a short-lived signed upload token. Staff and authorised parents receive a short-lived signed read URL only after API-level school, classroom, homework-link and shareability checks.

Cached paths are year- and resource-specific. Once a workbook edition has activity or homework usage, its file cannot be replaced through the API; Master must create a new edition. This keeps old page references stable. Previous unused cached paths are recorded in `learning_resource_file_history` when replaced and are not automatically deleted.

## Page references and workflow integration

Selected pages are stored as a sorted `integer[]`, with the existing `page_from` and `page_to` retained for compatibility. Database triggers verify school/classroom scope, resource scope and page bounds. The Classroom Activity screen can create a normal weekly activity or homework assignment with the selected pages, or attach them to an existing item. Weekly-plan and homework save functions preserve stable row IDs so ordinary edits do not silently remove links.

Parent access is only available through an authorised learner's homework assignment and a parent-shareable resource link. The parent receives no catalogue-management or editing ability. The Daily Summary preparation screen displays today's linked DBE activity references to staff; it does not add workbook metadata to the parent summary payload.

## Deployment order

1. Apply `20260914_grade_r_workbook_library.sql`.
2. Apply `20260914_preserve_workbook_usage_links.sql`.
3. Deploy the application.
4. In Master → DBE Workbook Catalogue, verify each official source and PDF, upload the private cached file, record its actual page count, mark the edition Current, and only then make the year current.

## Security assumptions to verify in production

- Existing `learning_resources`, activity, homework, classroom and parent RLS remains enabled.
- `learning_resource_years` and `learning_resource_file_history` have RLS enabled and no client grants; access is service-role API only.
- The `dbe-workbooks` bucket is private and has no broad object policies.
- Cross-school staff requests and unrelated parent workbook requests return 403/404.
- Master-only mutations reject Master Admin and school roles.

## Known operational limits

- Files are reviewed and cached manually; the application does not infer or fabricate new-year editions.
- Page-level learning-area classification is not included because no verified mapping is available.
- The first release renders one PDF page at a time and does not alter or extract pages from the official workbook.
- Source verification, production migration execution and authenticated mobile acceptance are deployment activities and cannot be established from repository checks alone.
