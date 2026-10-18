import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseCsv } from '../src/csv.ts';
import { analyze } from '../src/analyze.ts';
import { createVerifiedWorkbook } from '../src/workbook.ts';
import { createIntegrityReceipt, ownedBuffer } from '../src/integrity.ts';

test('receipt hashes exact source/output bytes and excludes values and filenames', async () => {
  const source = new TextEncoder().encode('\ufeffSecretHeader,Other\r\n00123,private-value-sentinel\r\n,\r\n');
  const file = parseCsv(source, 'private-customer-filename.csv');
  const workbook = await createVerifiedWorkbook(file.records);
  const receipt = await createIntegrityReceipt(file, analyze(file.records), workbook, '2026-10-18T00:00:00.000Z');
  const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  assert.equal(receipt.source.sha256, digest(source));
  assert.equal(receipt.review_workbook.sha256, digest(workbook.bytes));
  assert.equal(receipt.source.logical_records, 3); assert.equal(receipt.source.columns, 2);
  assert.equal(receipt.review_workbook.blank_fields, 2); assert.equal(receipt.review_workbook.exact_nonempty_text_cells, 4);
  assert.equal(receipt.risk_summary.findings, 1); assert.equal(receipt.risk_summary.cells_flagged, 1);
  assert.equal(receipt.risk_summary.counts['leading-zero'], 1);
  assert.equal(receipt.verification.passed, true); assert.equal(receipt.verification.native_spreadsheet_compatibility_tested, false);
  const json = JSON.stringify(receipt);
  for (const value of ['SecretHeader','Other','private-value-sentinel',file.filename]) assert.ok(!json.includes(value), value);
});

test('original-download buffer keeps BOM, newline styles and trailing separators byte for byte', () => {
  const source = new TextEncoder().encode('\ufeffA,B,\r\n001,002,\n');
  const file = parseCsv(source); const download = new Uint8Array(ownedBuffer(file.bytes));
  assert.deepEqual(download, source); download[0] = 0; assert.notEqual(download[0], file.bytes[0]);
});

test('a receipt is refused for mismatched source/workbook dimensions', async () => {
  const file = parseCsv(new TextEncoder().encode('a,b'));
  const workbook = await createVerifiedWorkbook([['different shape']]);
  await assert.rejects(createIntegrityReceipt(file, [], workbook), /dimensions do not match/);
});

test('a same-shape workbook for different source values cannot receive a passing receipt', async () => {
  const file = parseCsv(new TextEncoder().encode('00123'));
  const unrelatedWorkbook = await createVerifiedWorkbook([['00999']]);
  await assert.rejects(createIntegrityReceipt(file, [], unrelatedWorkbook), /changed string/);
});
