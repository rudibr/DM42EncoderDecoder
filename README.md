# DM42EncoderDecoder

A single-file, in-browser encoder/decoder for SwissMicros DM42 / Free42 / HP-42S programs.
Open `DM42EncoderDecoder.html` in any browser. It runs entirely offline, with no server.

![Typing and encoding a program, opening a .raw file, decoding pasted hex and saving a .raw](docs/demo.gif)

The demo types a short program and encodes it, opens `DPLOT.raw`, pastes hex and decodes it, then saves a `.raw` file.

- **Left:** program listing with line numbers, starting `0000 { n-Byte Prgm }`.
- **Right:** the raw bytes as hex, one line per instruction.
- **Encode →** turns the listing into raw bytes and renumbers it. **← Decode** turns hex back into a listing.
- **Open file / drag and drop:** `.raw` files are decoded; text listings (`.txt`) are encoded.
- **Save .raw / Save .txt:** download the program for the calculator or as text.

## Listing syntax

| | Example |
|---|---|
| Comments start with `'` or `;` outside a string | `STO 01   ' keep it`, `RTN ; done` |
| Line numbers and the header are optional | `0001`, `01▸`, `01▶`, `01◆` |
| Strings and append | `"TEXT"`, `├"MORE"` or `\|-"MORE"`; line feed `[LF]`, escape `[ESC]` |
| Registers, stack, indirect, names | `STO 07`, `RCL ST X`, `STO IND 03`, `RCL "NAME"`, `XEQ IND "P"` |
| Labels | `LBL "MAIN"`, `LBL 05`, `LBL A`, `LBL a` |
| Menus and keys | `KEY 1 XEQ 01`, `ASSIGN "X" TO 03` |
| ASCII spellings | `/ * ^ -> <= >= != RDN CHS SIGMA+ x2` |
| Unknown bytes | decode as `XROM mm,ff` or `HEX F2 …` and encode back unchanged |

It covers the full HP-42S instruction set plus the Free42/DM42 extensions (`FUNC`, `LSTO`, `L4STK`, `X=?`, `XSTR`, …).
Byte codes follow Free42's `core_tables.cc` and `export_hp42s`. Numbers are terminated with `00` and END is written as `C0 00 0D`, the same as Free42.

## Tests

```
node tests/run.js
```

The tests load the codec straight from `DM42EncoderDecoder.html` and check:

- **Byte-exact output** against the DPLOT example and its reference hex dump from Thomas Okken's
  [txt2raw page](https://thomasokken.com/free42/unsupported/txt2raw/): 491 bytes, `{ 488-Byte Prgm }`.
- **Published `{ n-Byte Prgm }` sizes** of 12 real programs from Eddie Shore's blog and the HP Museum forum,
  plus an encode → decode → encode round trip for each.
- **Single instructions**, including Free42 extensions, indirect and stack arguments, local labels, comments and error reporting.

The Free42-only extensions are checked against Free42's source tables and by round trip. No published `.raw` file containing them was available to compare against.
