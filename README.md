# CSV Preflight

A browser-local proof of concept for inspecting literal CSV values and producing a text-preserving review workbook. It does not clean, repair or infer the intended meaning of data.

## Run locally

Use Node 22.12 or newer. Development was tested with Node 24.6.0.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the printed local URL. Choose a UTF-8 comma-delimited CSV or the labelled fictional sample. Select a finding to inspect its exact text, then create a review workbook. A completed build has no runtime API dependency or paid service.

```sh
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

The independent workbook check also needs Python 3 and openpyxl. `npm test` invokes it for four generated fixture workbooks, writing a report under ignored `tests/output/`. The current suite has 28 tests; all passed, including the independent checks. The actual internal-browser sample download was separately checked with openpyxl: all 35 cells matched exactly as text. No credentials or environment variables are needed for the app.

## Preservation contract

- Retain the original bytes separately from the decoded table; do not trim, normalize or infer types.
- Keep the first CSV record as data. Coordinates are logical records and generic column letters.
- Store nonempty workbook cells as exact strings, including formula-looking input. Empty fields are equivalent to blank cells within the declared rectangular data range.
- Use a browser round-trip check before offering a workbook. Independent fixture checks use openpyxl; these are distinct kinds of evidence.
- No files are uploaded by application code. State remains in tab memory and is cleared by reset/reload. The static host still receives ordinary page/asset requests.

## Supported input and limits

UTF-8 CSV with optional UTF-8 BOM, comma separators, standard double quoting and LF/CRLF record endings. Embedded carriage returns and line breaks are permitted within quoted cells. Maximum 2 MiB, 5,000 logical records, 50 columns and 32,767 UTF-16 code units per cell. Records must have consistent widths. Invalid encoding, malformed quoting, unsupported XML controls and over-limit inputs fail without partial acceptance.

Checks flag leading-zero digit strings, strings longer than 15 digits, numeric E-notation patterns and formula-like prefixes. These are conservative pattern checks, not a full validator. Legitimate values can trigger a warning; an empty queue does not guarantee downstream compatibility.

## Limitations

No editing, cleaning, date interpretation, deduplication, lost-digit recovery, XLSX input, target-system upload or native spreadsheet compatibility guarantee. A review workbook does not replace CSV in a CSV-only workflow. If digits are already absent from the source, this tool cannot recover them. Native Excel and Google Sheets behavior has not been directly validated.

## Evidence and provenance

The scope in `devpost/scope.md` links two public Reddit reports and Microsoft documentation. They informed the problem; they are not customer interviews or measured outcomes. Microsoft already offers text-import and automatic-conversion controls. All bundled data is fictional. No earlier competition app code was reused.

The official Devpost Learn pack was installed before application code, from commit `a0f065781873e8a7ed9a9a705a8dafa6a0810439`. The scope, product plan, technical plan and build order were reviewed together and approved. The private learner profile is ignored by Git. Planning documents record actual progress; they do not claim unperformed hands-on checks or learning outcomes.

## Actual development tools

Codex, TypeScript, Vite, Papa Parse, ExcelJS, JSZip, Node.js built-in tests, Python/openpyxl, Git and the internal browser. An owner-only prototype preview used Sites; the selected public host is GitHub Pages with csv.nakshatraveda.tech. No ChatGPT Sites URL is used in the proposed submission. This is technical documentation, not the entrant's final submission answers.

## Project status

Registration confirmed. First slice approved. Original-byte CSV download and integrity receipt implemented and mechanically checked; final review and publication pending. Public repository, public demo video, remaining submission fields and final entry submission are pending.


## GitHub Pages packaging

```sh
npm run prepare:pages
```

This creates `docs/` from the production build only, adds `.nojekyll` and sets `CNAME` to `csv.nakshatraveda.tech`. Relative assets support a project subpath and the custom domain. Configure Pages to use `main` and `/docs`, claim the custom domain in GitHub, then add the exact Cloudflare CNAME. Wait for DNS/HTTPS verification before using the address in a submission.

The packaging script refuses to replace an unmarked existing `docs/` directory. The app has no runtime secrets. Do not publish the ignored learner profile, private research captures or local credentials. Public source is exported as a reviewed release snapshot; private development history is retained separately.

## Integrity receipt

After workbook verification, download `csv-integrity.json`. Its JSON body and generic filename omit source values and source filenames. The receipt hashes the unchanged source bytes and the generated workbook, checks workbook values against the source, and records supported risk counts and limitations. It is not a signed certificate. Tests reject a same-shaped workbook containing different values.
