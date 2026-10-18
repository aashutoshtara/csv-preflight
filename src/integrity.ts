import type { ParsedCsv } from './csv.ts';
import { LIMITS } from './csv.ts';
import { RISK_TYPES, type Finding, type RiskType } from './analyze.ts';
import type { VerifiedWorkbook } from './workbook.ts';
import { verifyWorkbook } from './workbook.ts';

export function ownedBuffer(bytes: Uint8Array): ArrayBuffer { return new Uint8Array(bytes).buffer; }
export async function sha256(bytes: Uint8Array): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', ownedBuffer(bytes));
  return Array.from(new Uint8Array(result), b => b.toString(16).padStart(2, '0')).join('');
}

/** Deliberate field allowlist: neither source values nor filenames enter a receipt. */
export async function createIntegrityReceipt(file: ParsedCsv, findings: Finding[], workbook: VerifiedWorkbook, checkedAt = new Date().toISOString()) {
  if (workbook.rows !== file.records.length || workbook.columns !== file.columns) throw new Error('The workbook dimensions do not match the source. No receipt was created.');
  const verified = await verifyWorkbook(workbook.bytes, file.records);
  const [sourceHash, workbookHash] = await Promise.all([sha256(file.bytes), sha256(workbook.bytes)]);
  const counts = Object.fromEntries((Object.keys(RISK_TYPES) as RiskType[]).map(kind => [kind, findings.filter(f => f.kind === kind).length]));
  return {
    schema: 'csv-preflight-integrity/v1',
    app_version: '0.1.0',
    checked_at: checkedAt,
    source: { sha256: sourceHash, bytes: file.bytes.byteLength, logical_records: file.records.length, columns: file.columns, encoding: 'UTF-8', delimiter: ',', original_bytes_retained: true },
    review_workbook: { sha256: workbookHash, bytes: workbook.bytes.byteLength, logical_range: verified.range, exact_nonempty_text_cells: verified.nonemptyCells, blank_fields: verified.blankCells },
    verification: { passed: true, method: 'ExcelJS browser round-trip with package validation', blank_policy: 'Blank cells equal empty CSV strings only within the declared logical data range.', native_spreadsheet_compatibility_tested: false },
    risk_summary: { cells_flagged: new Set(findings.map(f => `${f.row}:${f.col}`)).size, findings: findings.length, counts },
    limits: { source_bytes: LIMITS.bytes, logical_records: LIMITS.records, columns: LIMITS.columns, cell_utf16_units: LIMITS.cellCodeUnits },
    privacy: { includes_cell_contents: false, includes_filenames: false, application_uploaded_source: false },
    limitations: [
      'Hashes identify files; this receipt is not a digital signature or independent certification.',
      'The runtime workbook check uses the same library for writing and reading. Independent readers are used for development fixtures, not each uploaded file.',
      'Risk checks cover only the documented patterns and do not guarantee downstream import compatibility.',
      'Digits already missing from the source cannot be recovered. Use CSV for systems that require CSV.',
    ],
  };
}
