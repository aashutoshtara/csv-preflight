---
doc: spec
status: approved
origin: technical recommendation for combined review
---

# CSV literal-value preflight — technical specification

## How This Works, In Plain Language
The page retains selected CSV bytes and parses a separate text copy without number conversion. A rules module flags risky-looking strings. A workbook library writes all values as text, then reads them back to compare. The file stays in this tab; refreshing removes it. This architecture is recommended for the user's free-access constraints, not attributed as an already-approved choice.

## The Core Journey Through the System
File/sample → bytes and UTF-8 checks → CSV parser → immutable string records/findings → table/detail → XLSX writer → round-trip string/type check → local downloads/hashes. Implements `prd.md > The Core Journey`.

## Stack
- TypeScript and Vite, no framework/backend. Registry verified 18October2026: TypeScript7.0.2 Apache-2.0; Vite8.3.4 MIT. Local Node24.6.0/npm11.5.1. Verify dependency engine compatibility, then lock exact installed versions.
- [Papa Parse](https://www.papaparse.com/docs), registry5.7.0 MIT: comma delimiter, dynamicTyping:false, header:false, skipEmptyLines:false.
- [ExcelJS](https://github.com/exceljs/exceljs), registry4.4.0 MIT: explicit string cells and text number format; no formulas. Test empty/unusual values before assuming preservation.
- Browser File/Blob/TextDecoder/WebCrypto. No runtime network services.
- Node built-in tests plus independent Python openpyxl reading (available in this environment; required before claiming independent fixture verification). No CI or coverage platform required.

## Where It Runs and How Someone Tries It
`npm ci`, then `npm run dev -- --host 127.0.0.1`; open the printed URL in the internal browser. `npm run build` emits dist; `npm run preview -- --host 127.0.0.1` verifies it. No keys required. A private Sites prototype was used during development. The selected submission host is now GitHub Pages, with csv.nakshatraveda.tech managed through Cloudflare DNS; ChatGPT Sites URLs are excluded from submission materials. Public release is reviewed separately. Competition requires public open-source repo and public video under3min; deployment is optional.

## Look and Feel
Implement `prd.md > Look and Feel` with semantic controls, responsive grid, text-only cell rendering, pagination, local bundled assets, readable empty/error states and keyboard focus.

## Components

### CSV Input and Preservation
`src/csv.ts`: preserve Uint8Array; enforce2MiB before parse; reject UTF-16 BOM/invalidUTF-8; strip only UTF-8 BOM from parse view. Fail on parser errors, empty input, inconsistent widths, >5000records/>50columns, XML1.0-forbidden controls and >32,767 UTF-16-code-unit cells. Handle trailing separator without dropping real records. Implements `prd.md > Load and Preserve`.

### Risk Analysis
`src/analyze.ts`: pure string rules; findings carry zero-based indices/category/explanation key. UI shows one-based logical record and letter column. Digit-only checks, numeric E-pattern and conservative formula-prefix pattern; no mutation. Implements `prd.md > Understand Conversion Risks`.

### Workspace UI
`src/main.ts`: in-memory state, event handlers, paging/filtering/selection. Generation tokens prevent stale asynchronous results after replacement/reset. Revoke download URLs and release file/workbook references on reset. `src/style.css` owns layout. Implements `prd.md > Inspect Literal Values` and `prd.md > States and Boundaries`.

### Workbook and Integrity
`src/workbook.ts`: lazy ExcelJS import; explicit strings/text format, no formulas; re-read for a browser round-trip check, asserting exact strings/types for nonempty cells and absence of formulas. Normalize blank cells to empty strings only within the declared expected rectangle; retain that logical range in the workbook and receipt, including trailing empty rows/columns. Never infer original dimensions solely from nonempty cells. Empty-string handling is an early fixture. `src/integrity.ts`: SHA-256 and content-free receipt. Original download uses retained bytes; workbook download requires successful verification. Implements `prd.md > Export and Verify`.

### Synthetic Example
`src/sample.ts`: fictional postal/product codes, 17-digit identifier, E-shaped code, =1+1 text, Unicode, whitespace and quoted multiline content. Copy no real account/customer identifiers.

## File Structure
```text
index.html              shell
src/main.ts             rendering, events, in-memory state
src/style.css           responsive design
src/csv.ts              parsing/validation/preservation
src/analyze.ts          risk rules
src/workbook.ts         workbook write/read verification
src/integrity.ts        hashes/receipt
src/sample.ts           labelled fictional sample
tests/*.test.ts         deterministic fixtures
tests/verify_workbook.py independent XLSX reader
package.json            scripts and dependencies
package-lock.json       locked install
tsconfig.json           type checking
README.md               run instructions and limitations
LICENSE                 reviewed open-source license
devpost/                plans; private learner profile ignored
.agents/skills/         official curriculum and MIT attribution
```

## Data Model
ParsedFile contains bytes, filename, string[][] records, counts, source hash and findings. Selection/page/filter are separate UI state. WorkbookResult contains bytes/hash/verification. Receipt contains counts/metadata/hashes, not cells. All live only in tab memory.

## External Services
None at runtime. npm is build-time package distribution. Optional Sites serves static assets. GitHub/video host are publication destinations, not app dependencies.

## Failure Modes
Validation error clears stale outputs and offers recovery. Workbook failure blocks its download but preserves original. Token guard blocks stale results. Limits/pagination bound resource usage; no large-file promise or credit-consuming retries.

## Verification
Fixtures: leading zeros, long IDs, E-shaped strings, quoting/newlines, embedded CR/CRLF/tab, literal `_x0041_`/`_x000D_`, non-BMP Unicode/whitespace, formula/HTML-looking strings, blank values/trailing empty columns/entirely blank records, terminal-newline distinctions, BOM/CRLF, malformed CSV, inconsistent widths, limits and invalid encoding. Assert original byte hash; require independent openpyxl checks of exported workbook strings/types, declared dimensions, blank normalization and absence of formulas/external links. Internal-browser QA covers file/sample/findings/paging/reset/downloads and narrow layout. Native spreadsheet compatibility is unclaimed until separately tested.

## Decisions and Open Issues
The combined plan is approved. Prove empty-string workbook preservation before visual polish; report any consequential change instead of silently losing values. Verify runtime/dependency/independent-reader availability. No learner uncertainty or reflection invented. Final name/public prose remain pending.

Planning review approved on 18 October 2026. Personal registration answers and private learner context are excluded from this release.

## Verified implementation refinements
The parser normalizes only outside-field record endings in its parse view, preserving mixed LF/CRLF inputs and all quoted line breaks. It strips at most one byte-level UTF-8 BOM and protects a remaining literal U+FEFF from the parser library. Workbook output uses ExcelJS packaging and text styles plus a bounded JSZip XML correction to preserve CR, DEL and escape-like strings. Browser round-trip and independent openpyxl fixtures verify the exact results. JSZip 3.10.1 is a direct MIT dependency. A transitive UUID dependency is pinned to 11.1.1; production dependency audit reports no known vulnerabilities at the time of this check.

## GitHub Pages and custom domain
`npm run prepare:pages` builds the app with relative asset URLs and copies only compiled public files into generated `docs/`, with `.nojekyll` and `CNAME` set to `csv.nakshatraveda.tech`. Publish from the public repository main branch `/docs` folder. Configure the custom domain in GitHub before adding the Cloudflare CNAME `csv` → `aashutoshtara.github.io`, then verify DNS and HTTPS. Preserve unrelated apex, mail and other subdomain records. No deployment or DNS change is claimed until confirmed.
