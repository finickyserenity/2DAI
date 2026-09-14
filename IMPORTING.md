# Importing Google Sheets Lists

The Lists page accepts the tab-separated text produced when a Google Sheets range is copied or downloaded as TSV. Imports use the same preview and replacement transaction in development and production.

## Supported mapping

| Google Sheets column | 2Dai field |
| --- | --- |
| Task | Task title |
| Interval (`30` or `30!`) | Recurrence and fixed-schedule flag |
| Is-Due | Makes an interval-0 task visible in the planner |
| Last Done | Starting point for the next recurrence |
| Effort | Effort, defaulting to 1 |
| Earliest Completed | Last completion timestamp |
| Archive | Archived state |

Rows with an empty Task cell separate sections. Named rows such as `Kids` or `Guests` can be entered as **Category label rows**; these become prefixes for following sections and are not imported as tasks. Interval-0 tasks that are not due remain available in their List but do not flood Today.

## Development rehearsal

1. Preserve the original `.tab`/`.tsv` export under `data/` as a fixture. Files in this folder are available to the development server but are not copied into the production bundle.
2. Open **Lists → Import**.
3. Paste the export, choose the file, or use the development fixture button.
4. Set the list name and comma-separated category label rows.
5. Preview the task count and inferred section names.
6. Import and inspect the List, Today, Week, and Month views.
7. Correct source data or category settings and import again. The same list name atomically replaces the prior rehearsal.

## Production launch

1. Keep the Google Sheet unchanged as the rollback copy.
2. Create a fresh full export immediately before launch.
3. Import one List at a time using the same category settings tested in development.
4. Compare source and preview task counts before committing.
5. Verify representative recurrence, fixed recurrence (`!`), effort, archived, and list-only rows.
6. Export or back up the new local database after all Lists pass verification.
7. Keep the legacy spreadsheet until the production backup has been restored successfully on a second test device.

## Other list templates

The parser discovers columns by header name rather than fixed position. Other spreadsheets may contain extra helper columns or arrange supported columns differently. Use category label rows to model standalone headings; blank Task rows remain section separators. Any unsupported scheduling field should be added to the mapping and preview warnings before importing production data rather than silently discarded.