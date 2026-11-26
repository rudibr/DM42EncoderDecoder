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
  ["SIZE 100", "F3 F7 00 64"], ['XEQ a', 'E0 00 7B'], ['GTO A', 'D0 00 66'], ['LBL J', 'CF 6F'], ['XEQ IND ST X', 'AE F3'],
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
const c = D.encode(`LBL "T" ' entry\n"it's" ' apostrophe inside a string\nFOO 1\nSTO 128\nEND`);
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

// 6. Hide comments / line numbers (display only).
const lst = `0000 { 10-Byte Prgm }\n; header comment\n0001 LBL "T"           ' entry\n0002 "A;B"            ; text keeps its ;\n0003 12\n0004 END`;
check(D.viewListing(lst, true, false) === `0000 { 10-Byte Prgm }\n0001 LBL "T"\n0002 "A;B"\n0003 12\n0004 END`, 'listing: hide comments');
check(D.viewListing(lst, false, true) === `{ 10-Byte Prgm }\n; header comment\nLBL "T"          ' entry\n"A;B"            ; text keeps its ;\n12\nEND`, 'listing: hide line numbers');
check(D.viewListing(lst, true, true) === `{ 10-Byte Prgm }\nLBL "T"\n"A;B"\n12\nEND`, 'listing: hide both');
check(D.viewListing(lst, false, false) === lst, 'listing: nothing hidden is unchanged');
check(D.hexs(D.encode(D.viewListing(lst, true, true)).bytes) === D.hexs(D.encode(lst).bytes), 'a cleaned listing encodes to the same bytes');
const hx = D.hexListing(D.decode(D.encode(lst).bytes));
check(D.viewHex(hx, true, true) === 'C0 00 F2 00 54\nF3 41 3B 42\n11 12 00\nC0 00 0D', 'hex: hide both');
check(D.viewHex(hx, true, false).startsWith('0001: C0 00') && D.viewHex(hx, false, true).startsWith('; {'), 'hex: hide one at a time');
check(D.hexs(D.parseHex(D.viewHex(hx, true, true))) === D.hexs(D.encode(lst).bytes), 'cleaned hex still decodes');

// 7. Findings from Thomas Okken's program library (thomasokken.com/free42/42progs).
//    Byte codes checked against stress.raw / synth.raw / MES.raw / HPFX.raw from that page.
const lib = [
  ['INPUT IND 99', 'F2 EE E3'], ['INPUT IND ST L', 'F2 EE F4'], ['INPUT IND "Z"', 'F2 CD 5A'],
  ['KEY -6 GTO 99', 'F3 E3 0F 63'], ['KEY -1 XEQ "Z"', 'F3 C2 0A 5A'], ['ASSIGN "Z" TO -18', 'F3 C0 5A 23'], ['ASSIGN "Z" TO 01', 'F3 C0 5A 00'],
  ['LBL 122', 'CF 7A'], ['LBL ST L', 'CF 74'], ['ARCL 122', '9B 7A'], ['GTO ST L', 'D0 00 74'], ['ᴇ', '1B 00'], ['-ᴇ', '1C 1B 00'], ['14,1041', '11 14 1A 11 10 14 11 00'],
  ['CHDIR "Z"', 'F3 A7 53 5A'], ['CHDIR IND 99', 'F3 A7 10 E3'], ['EQNSLV ST L', 'F3 A7 37 74'], ['RAISE 13', 'F3 A7 3D 0D'], ['RAISE IND "Z"', 'F3 A7 3C 5A'],
  ['GSTO "Z"', 'F3 A7 34 5A'], ['GTOL 9999', 'F4 A7 32 27 0F'], ['XEQL 9999', 'F4 A7 33 27 0F'], ['SETDS', 'A2 7D'], ['→UNIT', 'A6 F5'], ['||', 'A7 B0'],
  ['RTNERR 4', 'F2 A0 04'], ['SIZE 26', 'F3 F7 00 1A'], ['"kg/cm^2"', 'F7 6B 67 2F 63 6D 5E 32'], ['"↑"', 'F1 5E'],
];
for (const [src, hx] of lib) {
  let got; try { got = D.hexs(D.encodeLine(src).bytes); } catch (err) { got = 'ERR ' + err; }
  const back = got.startsWith('ERR') ? '' : D.listing(D.decode(Uint8Array.from(got.split(' ').map(x => parseInt(x, 16))))).split('\n')[1].slice(5);
  check(got === hx && D.hexs(D.encodeLine(back).bytes) === hx, `${src} → ${got} (decodes as ${back})`);
}
const odd = D.encode(`"   [YYY"'-3YY'"\nLBL "S";entry\n"ABC" ' say "hi"\nSTO 01 @ at-sign comment`);
check(!odd.errors.length && odd.progs[0].lines.map(l => l.text).join('|') === `"   [YYY"'-3YY'"|LBL "S"|"ABC"|STO 01|END`, 'quotes and comment markers inside/after strings, @ comments');

// 8. Plus42 mode (byte layouts from Free42's stress.raw; whole file is byte-identical in this mode).
const P = { plus42: true };
const p42 = [
  ["'A*B+C*D'", 'F6 A7 76 FF FF FF FF F9 A7 41 41 2A 42 2B 43 2A 44'],
  ['`A*B+C*D`', 'F6 A7 76 FF FF FF FE F9 A7 41 41 2A 42 2B 43 2A 44'],
  ["EVAL 'A*B+C*D'", 'F6 A7 7E FF FF FF FF F9 A7 41 41 2A 42 2B 43 2A 44'],
  ['40076_km', 'A6 F7 14 10 10 17 16 00 F4 A7 41 6B 6D'],
  ['"SELECT ↑"', 'F8 53 45 4C 45 43 54 20 1E'],
];
for (const [src, hx] of p42) {
  let got; try { got = D.hexs(D.encodeLine(src, P).bytes); } catch (err) { got = 'ERR ' + err; }
  const dec = D.decode(Uint8Array.from(hx.split(' ').map(x => parseInt(x, 16))), P);
  check(got === hx && dec.plus42 && dec[0].lines[0].text === src, `Plus42: ${src} → ${got}`);
}
check(D.hexs(D.encodeLine('"↑"').bytes) === 'F1 5E' && D.hexs(D.encodeLine('"↑"', P).bytes) === 'F1 1E', '↑ is 5E in DM42 mode, 1E in Plus42 mode');
const pm = D.encode(`'A*B' ; equation, then a comment\nSTO 01 @ note\n' a DM42 comment`, P);
check(pm.errors.length === 1 && pm.errors[0].line === 3 && pm.progs[0].lines.map(l => l.text).join('|') === "'A*B'|STO 01|END", "Plus42 mode: ' starts an equation, ; and @ are comments, a ' comment line is an error");
check(D.encode("'A*B'").progs.length === 0 && /Plus42 mode/.test(D.encode('`A*B`').errors[0].msg) && /Plus42 mode/.test(D.encode('12_km').errors[0].msg), 'DM42 mode: \' is a comment, ` and unit literals ask for Plus42 mode');
check(!D.decode(D.encode('LBL "A"\n"x↑"').bytes).plus42, 'plain DM42 programs are not flagged as Plus42');

console.log(fails ? `\n${fails} FAILED` : '\nAll tests passed');
process.exit(fails ? 1 : 0);
