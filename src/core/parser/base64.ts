/* eslint-disable no-bitwise */
import {utf8Decode} from '../util/utf8';

const B64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeBase64Utf8(input: string): string {
  const clean = input.replace(/\s+/g, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    if (ch === '=') {
      break;
    }
    const val = B64_CHARS.indexOf(ch);
    if (val < 0) {
      continue;
    }
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return utf8Decode(bytes);
}

export function extractBase64Html(html: string): string {
  const m = /base64DecodeUtf8\("([^"]+)"\)/.exec(html);
  return m ? decodeBase64Utf8(m[1]) : html;
}
