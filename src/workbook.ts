import type { CellValue, Workbook } from "exceljs";
import type JSZip from "jszip";

const SHEET = "CSV Data";
const RANGE_NAME = "CSV_Data_Range";
const MAX_ROWS = 5_000;
const MAX_COLUMNS = 50;
const MAX_CELL_UNITS = 32_767;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

export interface WorkbookVerification {
  rows: number;
  columns: number;
  nonemptyCells: number;
  blankCells: number;
  /** Logical CSV rectangle, including trailing empty rows and columns. */
  range: string;
}

export interface VerifiedWorkbook extends WorkbookVerification {
  bytes: Uint8Array;
}

function columnName(column: number): string {
  let result = "";
  while (column > 0) {
    column--;
    result = String.fromCharCode(65 + column % 26) + result;
    column = Math.floor(column / 26);
  }
  return result;
}

function checkedSnapshot(records: string[][]): { records: string[][]; summary: WorkbookVerification } {
  if (!Array.isArray(records) || records.length === 0 || records.length > MAX_ROWS) {
    throw new Error("The workbook needs between 1 and 5,000 logical records.");
  }
  const columns = records[0]?.length;
  if (!Number.isInteger(columns) || columns < 1 || columns > MAX_COLUMNS) {
    throw new Error("The workbook needs between 1 and 50 columns.");
  }
  const copy: string[][] = [];
  let nonemptyCells = 0;
  let textBytes = 0;
  const encoder = new TextEncoder();
  for (let r = 0; r < records.length; r++) {
    const row = records[r];
    if (!Array.isArray(row) || row.length !== columns) {
      throw new Error(`Record ${r + 1} does not match the declared column count.`);
    }
    const values: string[] = [];
    for (let c = 0; c < columns; c++) {
      const value = row[c];
      const address = `${columnName(c + 1)}${r + 1}`;
      if (typeof value !== "string") throw new Error(`Cell ${address} is not a literal string.`);
      if (value.length > MAX_CELL_UNITS) {
        throw new Error(`Cell ${address} exceeds 32,767 UTF-16 code units.`);
      }
      // XML 1.0 permits TAB/LF/CR and DEL. Reject forbidden controls and lone
      // surrogates instead of relying on a serializer to discard or replace them.
      for (const char of value) {
        const point = char.codePointAt(0)!;
        if ((point < 0x20 && point !== 9 && point !== 10 && point !== 13)
          || (point >= 0xd800 && point <= 0xdfff) || point === 0xfffe || point === 0xffff) {
          throw new Error(`Cell ${address} contains a character unsupported by this workbook format.`);
        }
      }
      textBytes += encoder.encode(value).byteLength;
      if (textBytes > MAX_TEXT_BYTES) throw new Error("The workbook text exceeds the 2 MiB limit.");
      if (value !== "") nonemptyCells++;
      values.push(value);
    }
    copy.push(values);
  }
  return {
    records: copy,
    summary: {
      rows: copy.length,
      columns,
      nonemptyCells,
      blankCells: copy.length * columns - nonemptyCells,
      range: `A1:${columnName(columns)}${copy.length}`,
    },
  };
}

function xmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\r/g, "&#13;").replace(/\u007f/g, "&#127;");
}

function literalStringXml(value: string): string {
  // SpreadsheetML treats _xHHHH_ as an escape within each text run. Splitting
  // before x keeps an ORIGINAL escape-looking identifier literal, including
  // _x005F_ itself. No extra visible character or formatting is introduced.
  const starts = [...value.matchAll(/_(?=x[0-9a-fA-F]{4}_)/g)].map(match => match.index!);
  const text = (part: string) => `<t xml:space="preserve">${xmlText(part)}</t>`;
  if (starts.length === 0) return text(value);
  const parts: string[] = [];
  let cursor = 0;
  for (const position of starts) {
    if (position > cursor) parts.push(value.slice(cursor, position));
    parts.push("_");
    cursor = position + 1;
  }
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts.map(part => `<r>${text(part)}</r>`).join("");
}

async function loadLibraries() {
  const [excelModule, zipModule] = await Promise.all([import("exceljs"), import("jszip")]);
  return { Excel: excelModule.default ?? excelModule, Zip: zipModule.default ?? zipModule };
}

async function assertSafePackage(zip: JSZip): Promise<void> {
  const permitted = new Set([
    "[Content_Types].xml", "_rels/.rels", "docProps/app.xml", "docProps/core.xml",
    "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml",
    "xl/theme/theme1.xml", "xl/worksheets/sheet1.xml", "xl/sharedStrings.xml",
  ]);
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    if (!permitted.has(entry.name)) throw new Error("Workbook verification found an unexpected package part.");
    const xml = await entry.async("string");
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Workbook verification found an unsupported XML declaration.");
    if (/<(?:[\w.-]+:)?(?:f|formula1|formula2)(?:\s|>)/.test(xml)) {
      throw new Error("Workbook verification found a formula.");
    }
    if (entry.name.endsWith(".rels") && /TargetMode\s*=|hyperlink|externalLink/i.test(xml)) {
      throw new Error("Workbook verification found a link or external relationship.");
    }
    if (entry.name === "[Content_Types].xml" && /macroEnabled|vbaProject/i.test(xml)) {
      throw new Error("Workbook verification found macro content.");
    }
  }
  if (!zip.file("xl/worksheets/sheet1.xml") || !zip.file("xl/workbook.xml")) {
    throw new Error("Workbook verification found an incomplete package.");
  }
}

function plainStoredString(value: CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  // The bounded serialization pass uses plain text runs only to prevent an
  // escape-looking identifier from being decoded. ExcelJS calls this RichText;
  // the XLSX cell is still explicitly inlineStr, not a number or formula.
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)
    && value.richText.every(run => typeof run.text === "string")) {
    return value.richText.map(run => run.text).join("");
  }
  throw new Error("Workbook verification found a non-text cell.");
}

function checkLoadedWorkbook(book: Workbook, expected: string[][], summary: WorkbookVerification): void {
  if (book.worksheets.length !== 1 || book.worksheets[0].name !== SHEET) {
    throw new Error("Workbook verification found an unexpected worksheet.");
  }
  const name = book.definedNames.getRanges(RANGE_NAME);
  const expectedRange = `'${SHEET}'!$A$1:$${columnName(summary.columns)}$${summary.rows}`;
  const compactSingleCell = `'${SHEET}'!$A$1`;
  if (book.definedNames.model.length !== 1 || name.ranges.length !== 1
    || (name.ranges[0] !== expectedRange
      && !(summary.rows === 1 && summary.columns === 1 && name.ranges[0] === compactSingleCell))) {
    throw new Error("Workbook verification found a changed or missing logical data range.");
  }
  const sheet = book.worksheets[0];
  if (sheet.rowCount > summary.rows || sheet.columnCount > summary.columns) {
    throw new Error("Workbook verification found cells outside the declared data range.");
  }
  if (sheet.model.merges?.length) throw new Error("Workbook verification found merged data cells.");
  for (let r = 0; r < summary.rows; r++) {
    for (let c = 0; c < summary.columns; c++) {
      const cell = sheet.getCell(r + 1, c + 1);
      if (cell.numFmt !== "@") throw new Error(`Workbook verification found a changed text format at ${cell.address}.`);
      const actual = plainStoredString(cell.value);
      if (expected[r][c] === "") {
        if (actual !== null && actual !== "") throw new Error(`Workbook verification found a changed blank at ${cell.address}.`);
      } else if (actual !== expected[r][c]) {
        throw new Error(`Workbook verification found a changed string at ${cell.address}.`);
      }
    }
  }
}

/** Same-library browser round-trip check; independent openpyxl tests are separate. */
export async function verifyWorkbook(bytes: Uint8Array, expected: string[][]): Promise<WorkbookVerification> {
  const snapshot = checkedSnapshot(expected);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > 64 * 1024 * 1024) {
    throw new Error("Workbook verification received an empty or oversized file.");
  }
  const { Excel, Zip } = await loadLibraries();
  const zip = await Zip.loadAsync(bytes);
  await assertSafePackage(zip);
  const book = new Excel.Workbook();
  await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
  checkLoadedWorkbook(book, snapshot.records, snapshot.summary);
  return snapshot.summary;
}

export async function createVerifiedWorkbook(records: string[][]): Promise<VerifiedWorkbook> {
  // Snapshot before the first await so later UI replacement cannot alter this job.
  const snapshot = checkedSnapshot(records);
  const { Excel, Zip } = await loadLibraries();
  const book = new Excel.Workbook();
  const sheet = book.addWorksheet(SHEET);
  for (let r = 1; r <= snapshot.summary.rows; r++) {
    for (let c = 1; c <= snapshot.summary.columns; c++) {
      const cell = sheet.getCell(r, c);
      cell.value = "";
      cell.numFmt = "@";
    }
  }
  const range = `'${SHEET}'!$A$1:$${columnName(snapshot.summary.columns)}$${snapshot.summary.rows}`;
  book.definedNames.add(range, RANGE_NAME);
  const skeleton = await book.xlsx.writeBuffer({ useSharedStrings: false });
  const zip = await Zip.loadAsync(skeleton as unknown as Uint8Array);
  const sheetEntry = zip.file("xl/worksheets/sheet1.xml");
  if (!sheetEntry) throw new Error("The workbook writer did not create its data sheet.");
  const worksheetXml = await sheetEntry.async("string");
  const style = /<c\b[^>]*\bs="(\d+)"/.exec(worksheetXml)?.[1];
  if (!style || !worksheetXml.includes("<sheetData>")) {
    throw new Error("The workbook writer's text-cell layout could not be verified.");
  }
  // ExcelJS supplies the package, styles and named range. Insert literal XML
  // ourselves because its generic serializer strips DEL and leaves CR subject
  // to XML newline normalization. This changes no source value or source bytes.
  const rows = snapshot.records.map((values, r) => `<row r="${r + 1}">${values.map((value, c) => {
    const address = `${columnName(c + 1)}${r + 1}`;
    return value === ""
      ? `<c r="${address}" s="${style}"/>`
      : `<c r="${address}" s="${style}" t="inlineStr"><is>${literalStringXml(value)}</is></c>`;
  }).join("")}</row>`).join("");
  zip.file("xl/worksheets/sheet1.xml", worksheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${rows}</sheetData>`));
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const summary = await verifyWorkbook(bytes, snapshot.records);
  return { bytes, ...summary };
}
