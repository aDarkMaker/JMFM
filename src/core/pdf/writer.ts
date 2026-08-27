import type {PdfPage} from './index';

export interface WriterState {
  xrefOffsets: number[];
  outputOffset: number;
}

const enc = new TextEncoder();

export function createWriterState(): WriterState {
  return {xrefOffsets: [], outputOffset: 0};
}

function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) {
    len += p.length;
  }
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function pushObject(
  state: WriterState,
  objNum: number,
  body: string,
  streamData?: Uint8Array
): Uint8Array {
  while (state.xrefOffsets.length <= objNum) {
    state.xrefOffsets.push(-1);
  }
  state.xrefOffsets[objNum] = state.outputOffset;
  const head = enc.encode(`${objNum} 0 obj\n${body}\n`);
  const tail = enc.encode('\nendobj\n');
  let chunk: Uint8Array;
  if (streamData) {
    chunk = concat([head, enc.encode('stream\n'), streamData, enc.encode('\nendstream'), tail]);
  } else {
    chunk = concat([head, tail]);
  }
  state.outputOffset += chunk.length;
  return chunk;
}

export function buildHeader(state: WriterState, pageCount: number): Uint8Array {
  const header = concat([
    enc.encode('%PDF-1.4\n'),
    new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]),
  ]);
  state.outputOffset = header.length;
  const catalog = pushObject(state, 1, '<< /Type /Catalog /Pages 2 0 R >>');
  const kids = Array.from({length: pageCount}, (_, i) => `${3 + i * 3} 0 R`).join(' ');
  const pagesRoot = pushObject(state, 2, `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);
  return concat([header, catalog, pagesRoot]);
}

export function buildPage(
  state: WriterState,
  index: number,
  page: PdfPage,
  jpeg: Uint8Array
): Uint8Array {
  const base = 3 + index * 3;
  const w = page.width;
  const h = page.height;
  const pageBody =
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
    `/Resources << /XObject << /Im0 ${base + 1} 0 R >> >> /Contents ${base + 2} 0 R >>`;
  const imageBody =
    `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`;
  const contentText = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
  return concat([
    pushObject(state, base, pageBody),
    pushObject(state, base + 1, imageBody, jpeg),
    pushObject(state, base + 2, `<< /Length ${contentText.length} >>`, enc.encode(contentText)),
  ]);
}

export function buildFooter(state: WriterState): Uint8Array {
  const count = state.xrefOffsets.length;
  const xrefStart = state.outputOffset;
  let lines = `xref\n0 ${count}\n`;
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      lines += '0000000000 65535 f \n';
    } else {
      const off = state.xrefOffsets[i] ?? 0;
      lines += `${String(off).padStart(10, '0')} 00000 n \n`;
    }
  }
  lines += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return enc.encode(lines);
}
