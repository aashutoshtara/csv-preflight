import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { createVerifiedWorkbook, verifyWorkbook } from "../src/workbook.ts";

const output = new URL("./output/", import.meta.url);
const records = [
  ["postal", "identifier", "code", "literal", "unicode", "note", "blank", "space"],
  ["00123", "12345678901234567", "1E10", "=1+1", "Tārā 東京 😀", 'comma, quoted "text"', "", " "],
  ["00000", "9007199254740993", "001E02", "+SUM(A1:A2)", "𐐷", "LF\nnext", "", "tail"],
  ["0", "-00123", "@SUM(1,2)", "<script>alert(1)</script>", " & < > ' \" ", "CR\rnext", "", ""],
  ["_x0041_", "_x000D_", "_x005F_", "x005F_", "_x0041_x000D_", "CRLF\r\nnext", "", ""],
  ["_x00af_", "_xFFFF_", "__x0041_", "_x005F_x0041_", " 00123 ", "tab\tinside", "", ""],
  ["\u007f", "https://example.invalid", "A\u0085B", "line \u2028 separator", "emoji 😀", "one\rtwo\nthree\r\nfour", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["final", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", ""],
];

let fixtureBytes: Uint8Array;

test("literal identifiers, CR/CRLF/tab, escape-like tokens and Unicode survive workbook round-trip", async () => {
  const original = structuredClone(records);
  const result = await createVerifiedWorkbook(records);
  fixtureBytes = result.bytes;
  assert.deepEqual(records, original);
  assert.equal(result.rows, 10);
  assert.equal(result.columns, 8);
  assert.equal(result.range, "A1:H10");
  assert.equal(result.nonemptyCells, records.flat().filter(value => value !== "").length);
  assert.equal(result.blankCells, 80 - result.nonemptyCells);
  assert.deepEqual(await verifyWorkbook(result.bytes, records), {
    rows: result.rows, columns: result.columns, range: result.range,
    nonemptyCells: result.nonemptyCells, blankCells: result.blankCells,
  });
});

test("single blank and fully blank rectangular inputs retain their declared dimensions", async () => {
  for (const expected of [[[""]], [["", "", ""], ["", "", ""]]]) {
    const result = await createVerifiedWorkbook(expected);
    assert.equal(result.nonemptyCells, 0);
    assert.equal(result.blankCells, expected.length * expected[0].length);
    await verifyWorkbook(result.bytes, expected);
  }
});

test("generation snapshots input before asynchronous library loading", async () => {
  const input = [["00123", ""]];
  const pending = createVerifiedWorkbook(input);
  input[0][0] = "changed";
  const result = await pending;
  await verifyWorkbook(result.bytes, [["00123", ""]]);
});

test("rectangular input and explicit UTF-16/character limits fail before export", async () => {
  for (const invalid of [[], [[]], [["a"], []], [["a", "b"], ["c"]], [[12]], [["\ud800"]], [["\udfff"]]]) {
    await assert.rejects(createVerifiedWorkbook(invalid as string[][]));
  }
  for (const control of ["\0", "\u0008", "\u000b", "\u000c", "\u001f", "\ufffe", "\uffff"]) {
    await assert.rejects(createVerifiedWorkbook([[control]]), /unsupported/);
  }
  await assert.rejects(createVerifiedWorkbook([["a".repeat(32_768)]]), /UTF-16/);
  await assert.rejects(createVerifiedWorkbook([["😀".repeat(16_384)]]), /UTF-16/);
  await assert.rejects(createVerifiedWorkbook([Array(51).fill("")]), /50 columns/);
  await assert.rejects(createVerifiedWorkbook(Array.from({ length: 5_001 }, () => [""])), /5,000/);
});

test("maximum supported cell length and non-BMP boundary preserve exact text", async () => {
  const expected = [["a".repeat(32_767), "😀".repeat(16_383) + "x"]];
  const result = await createVerifiedWorkbook(expected);
  await verifyWorkbook(result.bytes, expected);
});

async function tamper(path: string, modify: (xml: string) => string): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(fixtureBytes);
  const entry = zip.file(path);
  assert.ok(entry);
  const before = await entry.async("string");
  const after = modify(before);
  assert.notEqual(before, after, "The tampering fixture must actually change its target");
  zip.file(path, after);
  return zip.generateAsync({ type: "uint8array" });
}

test("changed strings and numeric coercion are rejected", async () => {
  const changed = await tamper("xl/worksheets/sheet1.xml", xml => xml.replace("00123", "99999"));
  await assert.rejects(verifyWorkbook(changed, records), /changed string/);
  const numeric = await tamper("xl/worksheets/sheet1.xml", xml => xml.replace(/<c r="A2"[^>]*>[\s\S]*?<\/c>/, '<c r="A2" s="1" t="n"><v>123</v></c>'));
  await assert.rejects(verifyWorkbook(numeric, records), /non-text/);
});

test("formula and formula-looking literal are distinguished", async () => {
  const changed = await tamper("xl/worksheets/sheet1.xml", xml => xml.replace(/<c r="D2"[^>]*>[\s\S]*?<\/c>/, '<c r="D2" s="1"><f>1+1</f><v>2</v></c>'));
  await assert.rejects(verifyWorkbook(changed, records), /formula/);
  await verifyWorkbook(fixtureBytes, records);
});

test("changed logical ranges and extra cells are rejected", async () => {
  const wrongRange = await tamper("xl/workbook.xml", xml => xml.replace("$H$10", "$H$9"));
  await assert.rejects(verifyWorkbook(wrongRange, records), /logical data range/);
  const removedRange = await tamper("xl/workbook.xml", xml => xml.replace(/<definedNames>[\s\S]*?<\/definedNames>/, ""));
  await assert.rejects(verifyWorkbook(removedRange, records), /logical data range/);
  const extra = await tamper("xl/worksheets/sheet1.xml", xml => xml.replace("</sheetData>", '<row r="11"><c r="A11" s="1" t="inlineStr"><is><t>extra</t></is></c></row></sheetData>'));
  await assert.rejects(verifyWorkbook(extra, records), /outside/);
});

test("macro parts and external relationships are rejected", async () => {
  const zip = await JSZip.loadAsync(fixtureBytes);
  zip.file("xl/vbaProject.bin", new Uint8Array([1, 2, 3]));
  await assert.rejects(verifyWorkbook(await zip.generateAsync({ type: "uint8array" }), records), /unexpected package part/);
  const external = await tamper("xl/_rels/workbook.xml.rels", xml => xml.replace("</Relationships>", '<Relationship Id="rId999" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid" TargetMode="External"/></Relationships>'));
  await assert.rejects(verifyWorkbook(external, records), /link or external/);
});

test("independent openpyxl reader confirms values, types, named range and inert package", async () => {
  await mkdir(output, { recursive: true });
  const fixtures = [
    { file: "workbook-fidelity.xlsx", expected: records },
    { file: "workbook-all-blank.xlsx", expected: [["", "", ""], ["", "", ""]] },
    { file: "workbook-single-blank.xlsx", expected: [[""]] },
    { file: "workbook-length-boundary.xlsx", expected: [["a".repeat(32_767), "😀".repeat(16_383) + "x"]] },
  ];
  for (const fixture of fixtures) {
    const result = await createVerifiedWorkbook(fixture.expected);
    await writeFile(new URL(fixture.file, output), result.bytes);
  }
  const manifest = new URL("workbook-fixtures.json", output);
  await writeFile(manifest, JSON.stringify({ fixtures }, null, 2) + "\n");
  const result = spawnSync("python3", [fileURLToPath(new URL("./verify_workbook.py", import.meta.url)), fileURLToPath(manifest)], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.reader, "openpyxl");
  assert.equal(report.passed, 4);
  assert.equal(report.failed, 0);
});
