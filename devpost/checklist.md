---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast, approved with the combined plan on 18 October 2026. Early and final readiness reviews are complete. Local Git checkpoints approved.

## Slices

- [x] **1. Inspect a CSV and produce a verified text workbook**
  Becomes usable: Sample/file loads into literal table; findings select exact cells; workbook is downloadable after string verification.
  Why now: Proves the unique preservation kernel and uncertain empty-string workbook behavior immediately, with setup inside the usable flow.
  PRD ref: `prd.md > The Core Journey`, `prd.md > Load and Preserve`, `prd.md > Inspect Literal Values`, `prd.md > Understand Conversion Risks`, `prd.md > Export and Verify`
  Spec ref: `spec.md > CSV Input and Preservation`, `spec.md > Risk Analysis`, `spec.md > Workspace UI`, `spec.md > Workbook and Integrity`, `spec.md > File Structure`
  Build: Initialize isolated Git checkpoints after approval, install compatible locked dependencies, implement strict parsing, risk rules, accessible workspace and workbook generation/verification.
  Verify (mechanical): Type check/build; parser/risk/export fixtures; required independent XLSX reader (including blank-equivalence/dimensions and XML-looking text); internal-browser sample/file/findings/workbook download flow.
  Learner check: Inspect a flagged postal code and long identifier, download the workbook, and report unclear behavior or desired changes.
  Commit: `Build literal CSV inspection and verified text workbook`

- [x] **2. Complete integrity handoff and edge-state polish**
  Becomes usable: Original download and content-free receipt complete the loop; reset/errors/narrow layout/run instructions are ready.
  Why now: Builds on demonstrated preservation and early feedback, then completes the handoff.
  PRD ref: `prd.md > Export and Verify`, `prd.md > States and Boundaries`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Workspace UI`, `spec.md > Workbook and Integrity`, `spec.md > Failure Modes`, `spec.md > Verification`
  Build: Add hashes/receipt/original download; finish responsive/accessibility/error states and stale-result guards; accurate README and app map.
  Verify (mechanical): Focused full fixtures/build; downloaded original hash; receipt contains no cells; complete internal-browser journey including invalid input/reset; narrow-screen inspection.
  Learner check: Try the entire sample-to-download loop and one awkward file, then confirm refinements before publication.
  Commit: `Complete integrity downloads and review-ready workspace`

## Hands-on Checkpoints
- [x] Early usable behavior reviewed — user responded “looks good” to the preview on 18 October 2026. Specific clicks were not independently observed.
- [x] Final readiness review completed — learner approved the completed app for public release; no unreported individual test actions are claimed.

## Final Review
- [x] Final review complete — early feedback was positive and the completed app/public release was explicitly approved on 18 October 2026.

## Code Tour and App Map
- [x] Technical recap delivered — separate byte, parser and workbook checks, grounded in observed defects and actual tests; no personal learning outcome claimed
- [x] Optional edit/reflection not added to the chosen concise recap; none performed or inferred
- [x] `devpost/app-map.html` generated, paths/symbols structurally checked, and linked/opened for the learner; not browser-render verified

Activity and evidence: Slice 1 passes 24 automated tests including four independent workbook fixtures, a production build, and internal-browser sample/upload/findings/pagination/download/error/reset checks. Reviewer also ran 2,000 deterministic parser round trips. The user responded “looks good” to the early preview; no additional personal practice or learning outcome is inferred.
Route and stops: Reference route: main.ts load → csv.ts parseCsv/parseView → workbook.ts createVerifiedWorkbook/verifyWorkbook and integrity.ts createIntegrityReceipt. Not a completed learner code tour.
Edit outcome: Not applicable to the concise technical recap; no learner edit claimed.
Reflection: None requested or recorded; no personal testimonial generated.
Activity mode: Concise evidence-based technical recap and reference map. Final readiness was confirmed by explicit public-release approval.

## Revisions

- Final receipt review found its helper trusted a matching-shaped workbook and its download filename echoed the input name. The helper now checks workbook values against the source, and receipts download under a generic filename.

- User selected GitHub Pages for the submission URL and prohibited ChatGPT Sites URLs across competition submissions. The private prototype is historical development evidence only; it will not be used as the entry URL.

- Parser review found mixed record endings and a second BOM could alter values. Explicit record-ending handling and single-BOM removal now preserve them; regression fixtures cover both.
- Workbook review found library serialization changes for CR, DEL and escape-like tokens. A bounded XML correction and independent reader tests preserve these values without expanding the product scope.

- Before plan approval, independent review clarified empty-cell equivalence within declared dimensions, required independent fixture checks, terminal-line-ending handling and preservation of tabs/CR/Unicode/XML-looking strings. These preserve the proposed feature boundary.

Planning review approved on 18 October 2026. Personal registration answers and private learner context are excluded from this release.

Slice 2 mechanical evidence: 28 tests pass, four workbook fixtures independently checked, all three real browser downloads verified under /csv-preflight/, generic receipt filename confirmed, 390px iframe layout and workbook action checked, production build and Pages package succeed.
