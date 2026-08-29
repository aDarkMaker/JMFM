/* eslint-disable no-bitwise */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Incremental SHA-256 for streaming APK download hashing without buffering the whole file.
 * Lengths up to 2^53 bits (far beyond any APK) fit safely in a JS number.
 */
export class Sha256 {
  private state = new Uint32Array(8);
  private block = new Uint8Array(64);
  private blockLen = 0;
  private totalBytes = 0;

  constructor() {
    this.state.set([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
  }

  update(chunk: Uint8Array): this {
    let offset = 0;
    while (offset < chunk.length) {
      if (this.blockLen === 64) {
        this.transform();
        this.blockLen = 0;
      }
      const take = Math.min(64 - this.blockLen, chunk.length - offset);
      this.block.set(chunk.subarray(offset, offset + take), this.blockLen);
      this.blockLen += take;
      offset += take;
    }
    this.totalBytes += chunk.length;
    return this;
  }

  digest(): Uint8Array {
    const totalBits = this.totalBytes * 8;
    const padLen = ((56 - (this.blockLen + 1) % 64) + 64) % 64;
    const pad = new Uint8Array(1 + padLen + 8);
    pad[0] = 0x80;
    const hi = Math.floor(totalBits / 0x100000000);
    const lo = totalBits % 0x100000000;
    const tail = pad.length - 8;
    for (let i = 0; i < 4; i++) {
      pad[tail + i] = (hi >>> ((3 - i) * 8)) & 0xff;
      pad[tail + 4 + i] = (lo >>> ((3 - i) * 8)) & 0xff;
    }
    this.update(pad);
    if (this.blockLen === 64) {
      this.transform();
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i++) {
      out[i * 4] = (this.state[i] >>> 24) & 0xff;
      out[i * 4 + 1] = (this.state[i] >>> 16) & 0xff;
      out[i * 4 + 2] = (this.state[i] >>> 8) & 0xff;
      out[i * 4 + 3] = this.state[i] & 0xff;
    }
    return out;
  }

  private transform(): void {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++) {
      w[i] =
        (this.block[i * 4] << 24) |
        (this.block[i * 4 + 1] << 16) |
        (this.block[i * 4 + 2] << 8) |
        this.block[i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = this.state[0];
    let b = this.state[1];
    let c = this.state[2];
    let d = this.state[3];
    let e = this.state[4];
    let f = this.state[5];
    let g = this.state[6];
    let h = this.state[7];
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[i] + w[i]) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    this.state[0] = (this.state[0] + a) | 0;
    this.state[1] = (this.state[1] + b) | 0;
    this.state[2] = (this.state[2] + c) | 0;
    this.state[3] = (this.state[3] + d) | 0;
    this.state[4] = (this.state[4] + e) | 0;
    this.state[5] = (this.state[5] + f) | 0;
    this.state[6] = (this.state[6] + g) | 0;
    this.state[7] = (this.state[7] + h) | 0;
  }
}

export function sha256HexOf(bytes: Uint8Array): string {
  return bytesToHex(new Sha256().update(bytes).digest());
}

export function sha256Hex(bytes: Uint8Array): Promise<string> {
  return Promise.resolve(sha256HexOf(bytes));
}
