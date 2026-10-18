---
doc: scope
status: approved
origin: agent recommendation following delegated public-problem research
---

# CSV literal-value preflight — scope

## The Unique Kernel
Show what is actually stored in a CSV before spreadsheet software interprets identifiers as numbers. Preserve the source byte for byte, flag conversion risks, and create a separate review workbook with every nonempty value explicitly stored as text and empty fields retained as blank cells. Round-trip check the workbook before offering it for download; independently check fixtures during development.

## Who It's For
Operations workers and analysts checking small CSV exports containing postal codes, product codes or long account identifiers. This audience is inferred from public reports, not interviews or the entrant's personal workflow.

## The Core Loop
Choose a local CSV or labelled synthetic sample → inspect literal values and risk locations → select a finding to see the exact string → download the untouched CSV, verified all-text review workbook, or integrity receipt. No edits or automatic repairs.

## Evidence and Existing Remedies
- [Reddit: Sheets/Excel/Yext](https://www.reddit.com/r/excel/comments/1m1lpbl/need_to_get_sheetsexcel_to_stop_dropping_leading/) describes repeated ZIP corrections, but a commenter found the zero intact in the exported CSV. This supports separating source content from interpretation, not claiming Sheets export corrupts data. Yext requires CSV, so XLSX is only a review companion.
- [Reddit: long account numbers](https://www.reddit.com/r/excel/comments/1fqul3c/converting_a_csv_to_excel_and_it_keeps_adding_0s/) describes scientific notation and changed digits when opening files.
- [Microsoft text-import guidance](https://support.microsoft.com/en-us/excel/keeping-leading-zeros-and-large-numbers) and [automatic conversion controls](https://support.microsoft.com/en-us/excel/data-import-and-analysis-options-in-excel) are existing remedies. The app makes inspection and handoff clearer; it does not invent text import.
These qualitative reports do not establish market size, prevalence or customer validation. Fixtures will be synthetic.

## Inspiration & Identity
Agent proposal: one calm inspection workspace, warm neutral background, dark ink type, teal verified states, amber risks and monospace data. A selected-cell panel exposes exact text. The approved working interface uses CSV Preflight; final learner-written submission identity remains pending.

## Why This Matters to the Learner
The user asked to discover a public Reddit problem and complete a competition entry, within free access and using only the internal browser. No personal use or learning outcome is attributed to them.

## What “Working” Looks Like
The synthetic sample contains a leading-zero ZIP, 17-digit identifier, E-shaped code, formula-looking string, Unicode and quoted multiline field. Preview values are exact. Findings identify records and columns. The workbook contains exact string cells rather than numbers/formulas for nonempty fields; blank cells are equivalent to empty CSV strings within its declared rectangular dimensions. A required independent reader checks fixture values/types. Original download has the uploaded bytes' SHA-256. Unsupported input fails clearly without partial output.

## The POC Boundary
- One comma-delimited UTF-8 CSV, optional UTF-8 BOM; maximum 2 MiB, 5,000 logical records and 50 columns, with consistent record widths.
- Retain every record, including the first. Generic column letters avoid header/type guesses.
- Four risk checks: leading-zero digit strings, digit strings longer than 15 digits, numeric E-notation strings, and formula-looking prefixes. Risks do not prove corruption.
- Paginated literal preview, selected-cell detail, findings filter and downloads.
- Untouched CSV, verified all-text XLSX review companion, content-free JSON integrity receipt.
- File handling remains in tab memory: no API, runtime AI, accounts, analytics, persistence or server upload.
- Fresh code and fictional fixtures; no prior competition app code reused.

## Later
Other delimiters/encodings, larger files, target-specific import profiles and file comparison.

## Explicitly Cut
Cleaning, editing, deduplication, date guessing, lost-digit recovery, XLSX input, cloud storage, integrations, universal compatibility guarantees and measured time-saving claims. The workbook cannot replace CSV in CSV-only systems. A matching hash proves byte identity, not semantic correctness.

## Decisions and Approval
The user delegated discovery and solution selection. The scope, product plan, technical approach and build order were approved together. The first working prototype then received positive learner feedback. Final review and submission authorship remain separate.

Planning review approved on 18 October 2026. Personal registration answers and private learner context are excluded from this release.
