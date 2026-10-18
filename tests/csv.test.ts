import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, LIMITS } from '../src/csv.ts';
import { analyze, coordinate } from '../src/analyze.ts';
import { sha256 } from '../src/integrity.ts';

const parse = (text: string) => parseCsv(new TextEncoder().encode(text));
test('literal values retain zeroes, all digits, E-shaped text and whitespace', () => {
  assert.deepEqual(parse('00123,12345678901234567,1E10,  value  ').records, [['00123','12345678901234567','1E10','  value  ']]);
});
test('quoted commas, quotes, tabs and embedded CRLF are exact', () => {
  assert.deepEqual(parse('"a,b","""quote""","x\r\ny","a\tb"\r\n').records, [['a,b','"quote"','x\r\ny','a\tb']]);
});
test('trailing empty field and final record separator are distinct', () => {
  assert.deepEqual(parse('a,b,\n').records, [['a','b','']]);
  assert.deepEqual(parse('a\n\n').records, [['a'],['']]);
  assert.deepEqual(parse('""').records, [['']]);
  assert.throws(() => parse(''), /empty/);
});
test('BOM/CRLF original bytes are independently retained and hash identically', async () => {
  const input = new TextEncoder().encode('\ufeffA,B\r\n001,002\r\n'); const expected = new Uint8Array(input);
  const result = parseCsv(input); input[0] = 0;
  assert.deepEqual(result.records, [['A','B'],['001','002']]);
  assert.deepEqual(result.bytes, expected); assert.equal(await sha256(result.bytes), await sha256(expected));
});
test('literal Unicode, XML-looking escape sequences, and HTML-looking text are retained', () => {
  assert.deepEqual(parse('नमस्ते,🌱,_x0041_,<img src=x>').records, [['नमस्ते','🌱','_x0041_','<img src=x>']]);
});
test('mixed LF/CRLF record endings never merge records or alter quoted line endings', () => {
  assert.deepEqual(parse('a,b\r\nc,d\ne,f\r\n').records, [['a','b'],['c','d'],['e','f']]);
  assert.deepEqual(parse('a,b\nc,d\r\ne,f\n').records, [['a','b'],['c','d'],['e','f']]);
  assert.deepEqual(parse('"x\r\ny",b\r\n"x\ny",d\n').records, [['x\r\ny','b'],['x\ny','d']]);
});
test('at most one UTF-8 BOM is removed; a second is preserved as field content', () => {
  assert.deepEqual(parse('\ufeff\ufeff00123,b\n').records, [['\ufeff00123','b']]);
  assert.deepEqual(parse('\ufeff\ufeff').records, [['\ufeff']]);
  assert.deepEqual(parse('"\ufeff00123",b').records, [['\ufeff00123','b']]);
  assert.throws(()=>parse('\ufeff\ufeff"x",b'),/quote/i);
});
test('invalid UTF-8 and UTF-16 are rejected', () => {
  for (const bytes of [new Uint8Array([0xc3,0x28]), new Uint8Array([0xff,0xfe,0x41,0])]) assert.throws(()=>parseCsv(bytes),/UTF-8/);
});
test('malformed quotes and ragged records fail without partial parsing', () => {
  for (const source of ['"unfinished','a"b,c','"x"tail,y','"x" ,y']) assert.throws(()=>parse(source),/quot/i);
  assert.throws(()=>parse('a,b\nc'),/Record 2 has 1 fields/);
});
test('empty file and BOM-only file fail but a quoted empty cell is valid', () => {
  assert.throws(()=>parse('\ufeff'),/no CSV records/); assert.deepEqual(parse('""\n').records,[['']]);
});
test('unsupported controls fail; tabs and CR inside quoted fields survive', () => {
  assert.throws(()=>parse('x\u0000y'),/control character/);
  assert.deepEqual(parse('"x\ry","a\tb"').records,[['x\ry','a\tb']]);
  assert.throws(()=>parse('a\rb'),/record endings/);
});
test('limits reject full input, never truncate it', () => {
  assert.throws(()=>parseCsv(new Uint8Array(LIMITS.bytes+1)),/2 MiB/);
  assert.throws(()=>parse(Array.from({length:5001},()=> 'x').join('\n')),/5,000/);
  assert.throws(()=>parse(Array.from({length:51},()=> 'x').join(',')),/50 columns/);
  assert.throws(()=>parse('x'.repeat(32768)),/32,767/);
  assert.throws(()=>parse('🌱'.repeat(16384)),/32,767/);
  assert.equal(parse('x'.repeat(32767)).records[0][0].length,32767);
});
test('risk categories locate exact cells without mutating records', () => {
  const records = [['00604','12345678901234567','1E10','=1+1','ordinary','-12','0000000000000000']];
  const before = JSON.stringify(records);
  assert.deepEqual(analyze(records), [
    {row:0,col:0,kind:'leading-zero'}, {row:0,col:1,kind:'long-digits'}, {row:0,col:2,kind:'e-notation'},
    {row:0,col:3,kind:'formula-like'}, {row:0,col:5,kind:'formula-like'},
    {row:0,col:6,kind:'leading-zero'}, {row:0,col:6,kind:'long-digits'},
  ]);
  assert.equal(JSON.stringify(records),before);
});
test('risk checks are deliberately limited and conservative', () => {
  assert.deepEqual(analyze([['0','12','AB1E10','text@example.test','A=B']]),[]);
  assert.deepEqual(analyze([[' \t=1','+12','@SUM(A1)']]).map(f=>f.kind),['formula-like','formula-like','formula-like']);
  assert.equal(coordinate(0,26),'AA1'); assert.equal(coordinate(4999,49),'AX5000');
});
