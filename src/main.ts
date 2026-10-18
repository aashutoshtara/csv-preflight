import './style.css';
import { parseCsv, LIMITS, type ParsedCsv } from './csv.ts';
import { analyze, coordinate, columnName, RISK_TYPES, type Finding, type RiskType } from './analyze.ts';
import { sampleBytes } from './sample.ts';
import { sha256, ownedBuffer, createIntegrityReceipt } from './integrity.ts';
import { createVerifiedWorkbook } from './workbook.ts';

function $<T extends HTMLElement = HTMLElement>(id: string): T { return document.getElementById(id) as T; }
function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
interface Loaded { file: ParsedCsv; findings: Finding[]; hash: string; synthetic: boolean; }
let loaded: Loaded | null = null, generation = 0, page = 0;
let selected: { row: number; col: number } | null = null;
let workbookUrl: string | null = null;
let originalUrl: string | null = null, receiptUrl: string | null = null;
const PAGE_SIZE = 25;
const input = $<HTMLInputElement>('csv-file');
const filter = $<HTMLSelectElement>('risk-filter');
for (const [value, meta] of Object.entries(RISK_TYPES)) {
  const option = element('option', meta.label); option.value = value; filter.append(option);
}

function clearWorkbook(): void {
  if (workbookUrl) URL.revokeObjectURL(workbookUrl);
  workbookUrl = null;
  if (receiptUrl) URL.revokeObjectURL(receiptUrl);
  receiptUrl = null;
  const link = $<HTMLAnchorElement>('workbook-download'); link.hidden = true; link.removeAttribute('href');
  const receipt = $<HTMLAnchorElement>('receipt-download'); receipt.hidden = true; receipt.removeAttribute('href');
  $('receipt-hint').hidden = false;
  $('generate').hidden = false; $<HTMLButtonElement>('generate').disabled = false;
  $('workbook-status').textContent = 'Ready when you are.'; $('workbook-status').className = 'verification-state';
}
function clearState(): void {
  generation++; loaded = null; selected = null; page = 0; filter.value = 'all'; clearWorkbook();
  if (originalUrl) URL.revokeObjectURL(originalUrl);
  originalUrl = null;
  $<HTMLAnchorElement>('original-download').removeAttribute('href');
  $('workspace').hidden = true; $('intro').hidden = false; $('principles').hidden = false; $('reset').hidden = true;
  $('error').hidden = true; $('error').textContent = ''; input.value = '';
  $('notice').textContent = 'Your file stays in this tab. No account, upload or AI service is involved.';
  $('load-title').textContent = 'Start with a file. Keep it local.';
  $('data-table').querySelector('tbody')!.replaceChildren(); $('findings').replaceChildren(); $('cell-detail').replaceChildren();
  $('source-hash').textContent = ''; $('file-name').textContent = '';
}
function showError(error: unknown): void {
  $('error').textContent = error instanceof Error ? error.message : 'The file could not be processed. Try another CSV.';
  $('error').hidden = false;
}
async function load(read: () => Promise<Uint8Array>, name: string, synthetic = false): Promise<void> {
  clearState(); const token = generation;
  $('notice').textContent = 'Reading and checking the CSV locally…';
  try {
    const bytes = await read(); if (token !== generation) return;
    const file = parseCsv(bytes, name); const hash = await sha256(file.bytes);
    if (token !== generation) return;
    loaded = { file, hash, findings: analyze(file.records), synthetic };
    originalUrl = URL.createObjectURL(new Blob([ownedBuffer(file.bytes)], { type: 'text/csv;charset=utf-8' }));
    const original = $<HTMLAnchorElement>('original-download'); original.href = originalUrl;
    original.download = downloadStem(name) + '-original.csv';
    $('intro').hidden = true; $('principles').hidden = true; $('workspace').hidden = false; $('reset').hidden = false;
    $('load-title').textContent = 'Inspect another file';
    $('notice').textContent = synthetic ? 'Synthetic sample loaded. All locations and identifiers are fictional.' : 'File loaded locally. Nothing was uploaded or changed.';
    $('file-name').textContent = name;
    $('file-context').textContent = `${synthetic ? 'Fictional example' : 'Local file'} · ${(file.bytes.byteLength / 1024).toFixed(1)} KiB · UTF-8, comma separated`;
    $('record-count').textContent = file.records.length.toLocaleString(); $('column-count').textContent = String(file.columns);
    $('risk-count').textContent = String(new Set(loaded.findings.map(f => `${f.row}:${f.col}`)).size);
    $('source-hash').textContent = hash; renderFindings(); renderTable();
    const first = loaded.findings[0]; selectCell(first?.row ?? 0, first?.col ?? 0);
  } catch (error) { if (token === generation) { $('notice').textContent = 'No file loaded. Choose another CSV or try the sample.'; showError(error); } }
}
function renderFindings(): void {
  if (!loaded) return;
  const matching = loaded.findings.filter(f => filter.value === 'all' || f.kind === filter.value);
  $('finding-count').textContent = String(matching.length);
  const container = $('findings'); container.replaceChildren();
  for (const finding of matching.slice(0, 100)) {
    const button = element('button', undefined, 'finding'); button.type = 'button';
    button.setAttribute('aria-label', `${RISK_TYPES[finding.kind].short} at ${coordinate(finding.row, finding.col)}`);
    button.append(element('span', coordinate(finding.row, finding.col), 'finding-coordinate'), element('span', RISK_TYPES[finding.kind].short, 'finding-kind'));
    const value = loaded.file.records[finding.row][finding.col];
    button.append(element('code', value.length > 45 ? value.slice(0, 42) + '…' : value));
    button.addEventListener('click', () => selectCell(finding.row, finding.col)); container.append(button);
  }
  if (!matching.length) container.append(element('p', 'No matching risks found. This is not a guarantee of downstream import compatibility.', 'empty-findings'));
  $('findings-overflow').textContent = matching.length > 100 ? `Showing the first 100 of ${matching.length.toLocaleString()} findings. All risk cells remain highlighted in the table.` : '';
}
function renderTable(): void {
  if (!loaded) return;
  const { records, columns } = loaded.file;
  const head = $('data-table').querySelector('thead')!, body = $('data-table').querySelector('tbody')!;
  head.replaceChildren(); body.replaceChildren();
  const header = element('tr'); header.append(element('th', '#'));
  for (let c = 0; c < columns; c++) { const th = element('th', columnName(c)); th.scope = 'col'; header.append(th); }
  head.append(header);
  const riskCells = new Set(loaded.findings.map(f => `${f.row}:${f.col}`));
  for (let r = page * PAGE_SIZE; r < Math.min((page + 1) * PAGE_SIZE, records.length); r++) {
    const tr = element('tr'); const rowLabel = element('th', String(r + 1)); rowLabel.scope = 'row'; tr.append(rowLabel);
    records[r].forEach((value, c) => {
      const td = element('td'); const cell = element('button', value === '' ? '∅' : value.length > 120 ? value.slice(0, 117) + '…' : value, 'cell');
      cell.type = 'button'; cell.title = `Inspect ${coordinate(r, c)}`; cell.setAttribute('aria-label', `Inspect cell ${coordinate(r, c)}`);
      cell.setAttribute('aria-pressed', String(selected?.row === r && selected?.col === c));
      if (value === '') cell.classList.add('empty-cell');
      if (riskCells.has(`${r}:${c}`)) cell.classList.add('risk-cell');
      cell.addEventListener('click', () => selectCell(r, c)); td.append(cell); tr.append(td);
    }); body.append(tr);
  }
  const first = page * PAGE_SIZE + 1, last = Math.min((page + 1) * PAGE_SIZE, records.length);
  $('page-label').textContent = `Records ${first}–${last} of ${records.length.toLocaleString()}`;
  $<HTMLButtonElement>('previous').disabled = page === 0;
  $<HTMLButtonElement>('next').disabled = last >= records.length;
}
function selectCell(row: number, col: number): void {
  if (!loaded) return;
  selected = { row, col }; page = Math.floor(row / PAGE_SIZE); renderTable();
  const value = loaded.file.records[row][col], detail = $('cell-detail'); detail.replaceChildren();
  const title = element('div', undefined, 'cell-detail-heading');
  title.append(element('strong', `Cell ${coordinate(row, col)}`), element('span', `${value.length.toLocaleString()} UTF-16 units · literal text`));
  detail.append(title, element('pre', JSON.stringify(value), 'exact-value'));
  const matches = loaded.findings.filter(f => f.row === row && f.col === col);
  for (const f of matches) detail.append(element('p', RISK_TYPES[f.kind].explanation, 'risk-explanation'));
  if (!matches.length) detail.append(element('p', value === '' ? 'Empty field. The review workbook retains this as a blank cell within the declared data range.' : 'No supported conversion-risk pattern found in this value.', 'muted'));
}
async function generateWorkbook(): Promise<void> {
  if (!loaded) return;
  const token = generation, current = loaded;
  $<HTMLButtonElement>('generate').disabled = true; $('error').hidden = true;
  $('workbook-status').textContent = 'Creating the text workbook and checking every value…';
  try {
    const result = await createVerifiedWorkbook(current.file.records);
    if (token !== generation) return;
    const receipt = await createIntegrityReceipt(current.file, current.findings, result);
    if (token !== generation) return;
    workbookUrl = URL.createObjectURL(new Blob([ownedBuffer(result.bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const link = $<HTMLAnchorElement>('workbook-download'); link.href = workbookUrl;
    link.download = downloadStem(current.file.filename) + '-text-review.xlsx';
    receiptUrl = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2) + '\n'], { type: 'application/json' }));
    const receiptLink = $<HTMLAnchorElement>('receipt-download'); receiptLink.href = receiptUrl;
    receiptLink.download = 'csv-integrity.json'; receiptLink.hidden = false;
    $('receipt-hint').hidden = true;
    link.hidden = false; $('generate').hidden = true;
    $('workbook-status').textContent = `Round-trip check passed: ${result.nonemptyCells.toLocaleString()} exact text values and ${result.blankCells.toLocaleString()} blank fields across ${result.range}.`;
    $('workbook-status').className = 'verification-state verified';
  } catch (error) {
    if (token !== generation) return;
    showError(error); $('workbook-status').textContent = 'Verification did not complete. No workbook is offered for download.';
    $<HTMLButtonElement>('generate').disabled = false;
  }
}
function downloadStem(name: string): string { return name.replace(/\.csv$/i, '').replace(/[\\/<>:"|?*\u0000-\u001f]/g, '_').slice(0, 120) || 'source'; }
$('choose-file').addEventListener('click', () => input.click());
input.addEventListener('change', () => {
  const file = input.files?.[0]; if (!file) return;
  void load(async () => {
    if (file.size > LIMITS.bytes) throw new Error('This proof of concept accepts files up to 2 MiB. Choose a smaller CSV.');
    return new Uint8Array(await file.arrayBuffer());
  }, file.name);
});
$('sample').addEventListener('click', () => { void load(async () => sampleBytes(), 'fictional-operations.csv', true); });
$('reset').addEventListener('click', clearState);
filter.addEventListener('change', renderFindings);
$('previous').addEventListener('click', () => { if (page > 0) { page--; renderTable(); } });
$('next').addEventListener('click', () => { if (loaded && (page + 1) * PAGE_SIZE < loaded.file.records.length) { page++; renderTable(); } });
$('generate').addEventListener('click', () => { void generateWorkbook(); });
window.addEventListener('pagehide', clearState);
