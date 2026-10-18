import Papa from 'papaparse';

export const LIMITS = { bytes: 2 * 1024 * 1024, records: 5000, columns: 50, cellCodeUnits: 32767 } as const;
export interface ParsedCsv { bytes: Uint8Array; records: string[][]; columns: number; filename: string; }

function parseView(text: string): string {
  let quoted = false, closed = false, fieldStart = true, normalized = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      normalized += c;
      if (c === '"') {
        if (text[i + 1] === '"') { normalized += '"'; i++; }
        else { quoted = false; closed = true; }
      }
      continue;
    }
    if (c === ',' || c === '\n' || c === '\r') {
      if (c === '\r') {
        if (text[i + 1] !== '\n') throw new Error('Use LF or CRLF record endings. A lone carriage return outside a quoted field is unsupported.');
        i++;
      }
      normalized += c === ',' ? ',' : '\n';
      fieldStart = true; closed = false;
    } else if (closed) {
      throw new Error('A closed quoted field must be followed by a comma or a line ending. Check the CSV quoting.');
    } else if (c === '"') {
      if (!fieldStart) throw new Error('A quote inside an unquoted field is invalid. Export the file as standard comma-delimited CSV.');
      normalized += c; quoted = true; fieldStart = false;
    } else { normalized += c; fieldStart = false; }
  }
  if (quoted) throw new Error('A quoted field is not closed. Check the CSV quoting and try again.');
  // Papa also removes an initial U+FEFF from string input. After the one byte-level
  // BOM has been handled below, any remaining U+FEFF is actual field content.
  if (normalized.startsWith('\ufeff')) {
    const boundary = normalized.search(/[,\n]/);
    const end = boundary === -1 ? normalized.length : boundary;
    normalized = '"' + normalized.slice(0, end) + '"' + normalized.slice(end);
  }
  return normalized;
}

export function parseCsv(input: Uint8Array, filename = 'source.csv'): ParsedCsv {
  if (input.byteLength > LIMITS.bytes) throw new Error('This proof of concept accepts files up to 2 MiB. Choose a smaller CSV.');
  if (!input.byteLength) throw new Error('This file is empty. Choose a CSV containing at least one record.');
  const bytes = new Uint8Array(input);
  let text: string;
  const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(hasBom ? bytes.subarray(3) : bytes); }
  catch { throw new Error('This file is not valid UTF-8. Export a UTF-8 comma-delimited CSV and try again.'); }
  if (!text.length) throw new Error('This file contains no CSV records. Choose a file with content.');
  const view = parseView(text);
  const result = Papa.parse<string[]>(view, {
    delimiter: ',', newline: '\n', header: false, dynamicTyping: false, skipEmptyLines: false,
  });
  if (result.errors.length) throw new Error(`CSV parsing failed: ${result.errors[0].message}`);
  const records = result.data;
  // Papa Parse adds a synthetic last record after a terminal line ending.
  // Remove one such record only; trailing fields and actual blank records remain.
  if (text.endsWith('\n') && records.length > 1 && records.at(-1)?.length === 1 && records.at(-1)?.[0] === '') records.pop();
  if (!records.length) throw new Error('No records were found in this CSV.');
  if (records.length > LIMITS.records) throw new Error('This proof of concept accepts up to 5,000 logical records, including the first row.');
  const columns = records[0].length;
  if (columns > LIMITS.columns) throw new Error('This proof of concept accepts up to 50 columns.');
  records.forEach((row, r) => {
    if (row.length !== columns) throw new Error(`Record ${r + 1} has ${row.length} fields; the first has ${columns}. Use a CSV with consistent record widths.`);
    row.forEach((cell, c) => {
      if (cell.length > LIMITS.cellCodeUnits) throw new Error(`Record ${r + 1}, column ${c + 1} exceeds the 32,767 UTF-16-unit cell limit for this workbook export.`);
      for (const ch of cell) {
        const cp = ch.codePointAt(0)!;
        if ((cp < 0x20 && ![9, 10, 13].includes(cp)) || cp === 0xfffe || cp === 0xffff) {
          throw new Error(`Record ${r + 1}, column ${c + 1} contains a control character unsupported by the review workbook. No values were changed.`);
        }
      }
    });
  });
  return { bytes, records, columns, filename };
}
