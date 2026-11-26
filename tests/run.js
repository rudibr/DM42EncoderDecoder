// node tests/run.js — runs every check and exits non-zero on failure.
const D = require('./codec.js'), fs = require('fs'), path = require('path');
const f = n => fs.readFileSync(path.join(__dirname, n), 'utf8');
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };

// 1. Byte-exact against Thomas Okken's txt2raw DPLOT example (listing + reference hex dump).
const ref = Uint8Array.from(f('dplot.hex').split('\n').flatMap(l => l.trim().split(/\s+/).slice(1)).filter(Boolean).map(x => parseInt(x, 16)));
const e = D.encode(f('dplot.txt'));
check(!e.errors.length && D.hexs(e.bytes) === D.hexs(ref), `DPLOT encodes byte-identical to reference (${ref.length} bytes)`);
const dec = D.decode(ref);
const want = f('dplot.txt').trim().split('\n').map(l => D.encodeLine(l.replace(/^\d+\s*>?\s*/, '')).text);
check(dec[0].lines.map(l => l.text).join('\n') === want.join('\n') && dec[0].size === 488, 'DPLOT reference raw decodes to the original 154 lines, 488-Byte Prgm');

// 2. Published { n-Byte Prgm } sizes + round trip.
for (const file of ['eddie.txt', 'more.txt']) {
  const src = f(file), exp = [...src.matchAll(/\{\s*(\d+)-Byte Prgm\s*\}/g)].map(m => +m[1]);
  const r = D.encode(src);
  r.progs.forEach((p, k) => check(p.size === exp[k], `${file} program ${k + 1}: ${p.size} bytes (published ${exp[k]})`));
  const again = D.encode(D.listing(D.decode(r.bytes)));
  check(D.hexs(again.bytes) === D.hexs(r.bytes), `${file} encode → decode → encode is stable`);
}

// 3. Single instructions.
const cases = [
  ['LBL "ABC"', 'C0 00 F4 00 41 42 43'], ['5', '15 00'], ['TONE ST X', '9F 73'], ['DSE ST X', '97 73'],
  ['X=? 05', 'F3 A7 14 05'], ['X≤? ST Y', 'F3 A7 18 72'], ['LSTO "A"', 'F2 C7 41'], ['LCLV "AB"', 'F4 A7 71 41 42'],
  ['FUNC 21', 'F2 E0 15'], ['RTNERR IND "E"', 'F2 E4 45'], ['L4STK', 'A7 E3'], ['FIX 11', 'F1 E5'], ['SCI 10', 'F1 D6'],
  ['SIZE 0100', 'F3 F7 00 64'], ['XEQ a', 'E0 00 7B'], ['GTO A', 'D0 00 66'], ['LBL J', 'CF 6F'], ['XEQ IND ST X', 'AE F3'],
  ['GTO IND 05', 'AE 05'], ['KEY 3 XEQ IND "Q"', 'F3 CA 03 51'], ['ASSIGN "AB" TO 18', 'F4 C0 41 42 11'], ['STO 15', '3F'],
  ['STO 16', '91 10'], ['RCL IND ST L', '90 F4'], ['-1.5E-3', '1C 11 1A 15 1B 1C 13 00'], ['DROPN 3', 'F2 A1 03'],
  ['XROM 05,12', 'A1 4C'], ['├"X"', 'F2 7F 58'], ['INPUT 07', 'F2 D0 07'], ['CLV IND 03', 'F2 D8 83'],
  ['XSTR "HELLO"', 'F7 A7 41 48 45 4C 4C 4F'], ['x2', '51'], ['X⇔Y', '71'], ['STO + 01', '92 01'], ['X!=Y?', '79'], ['RDN', '75'],
];
for (const [src, hx] of cases) {
  let got; try { got = D.hexs(D.encodeLine(src).bytes); } catch (err) { got = 'ERR ' + err; }
  const back = got.startsWith('ERR') ? '' : D.listing(D.decode(Uint8Array.from(got.split(' ').map(x => parseInt(x, 16)))));
  check(got === hx && !back.includes('HEX '), `${src} → ${got}`);
}

// 4. Comments and errors.
const c = D.encode(`LBL "T" ' entry\n"it's" ' apostrophe inside a string\nFOO 1\nSTO 123\nEND`);
check(c.errors.length === 2 && c.progs[0].size === 10, 'comments ignored, bad lines reported');

const sc = D.encode(`LBL "S";entry\n"A;B" ; semicolon inside a string is text\nSTO 01 ; store\n; whole-line comment\n"it's; ok"' both\nEND`);
check(!sc.errors.length && D.hexs(sc.bytes) === 'C0 00 F2 00 53 F3 41 3B 42 31 F8 69 74 27 73 3B 20 6F 6B C0 00 0D', '; comments, ; and \' inside strings kept as text');
check(D.format(sc).includes('0003 STO 01           ; store') && D.format(sc).includes('; whole-line comment'), '; comments preserved when renumbering');

// 5. EDLEN listing: ▶ label markers, ; comments, [LF] in strings, Free42 extensions.
const ed = D.encode(f('edlen.txt'));
check(!ed.errors.length && ed.progs.length === 1 && ed.progs[0].lines.length === 257, `EDLEN: 257 lines, no errors (${ed.errors.length} errors)`);
check(D.hexs(D.encodeLine('├"°C[LF]RH="').bytes) === 'F7 7F 13 43 0A 52 48 3D', '[LF] encodes as one 0A byte');
check(D.hexs(D.encode(D.listing(D.decode(ed.bytes))).bytes) === D.hexs(ed.bytes), 'EDLEN encode → decode → encode is stable');
check(D.hexs(D.encodeLine('LBL "A▶"').bytes) === 'C0 00 F3 00 41 06', '▶ inside a string is still a character');

console.log(fails ? `\n${fails} FAILED` : '\nAll tests passed');
process.exit(fails ? 1 : 0);
