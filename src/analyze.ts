export const RISK_TYPES = {
  'leading-zero': { label: 'Leading zeros', short: 'Leading zero', explanation: 'A numeric import may remove the zero at the start. The literal text shown here still contains it.' },
  'long-digits': { label: 'Long identifiers', short: 'Long digits', explanation: 'This digit string is longer than Excel’s 15-digit numeric precision. Store it as text to retain every digit.' },
  'e-notation': { label: 'E-shaped values', short: 'E notation', explanation: 'Spreadsheet software may interpret this as scientific notation. It may be a valid number or an identifier; this app does not decide which.' },
  'formula-like': { label: 'Formula-like text', short: 'Formula-like', explanation: 'This prefix may be interpreted as a formula by some spreadsheet software. The review workbook stores the whole value as inert text. Legitimate negative numbers can also trigger this check.' },
} as const;
export type RiskType = keyof typeof RISK_TYPES;
export interface Finding { row: number; col: number; kind: RiskType; }
export function analyze(records: string[][]): Finding[] {
  const findings: Finding[] = [];
  records.forEach((row, r) => row.forEach((value, c) => {
    const add = (kind: RiskType) => findings.push({ row: r, col: c, kind });
    if (/^0\d+$/.test(value)) add('leading-zero');
    if (/^\d{16,}$/.test(value)) add('long-digits');
    if (/^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(value)) add('e-notation');
    if (/^[\s]*[=+\-@]/u.test(value)) add('formula-like');
  }));
  return findings;
}
export function columnName(index: number): string {
  let label = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label;
  return label;
}
export function coordinate(row: number, col: number): string { return `${columnName(col)}${row + 1}`; }
