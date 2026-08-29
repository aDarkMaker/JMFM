import {Sha256, sha256Hex, sha256HexOf} from '@/core/util/sha256';

describe('Sha256', () => {
  it('matches reference vectors', () => {
    expect(sha256HexOf(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
    expect(sha256HexOf(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(sha256HexOf(new TextEncoder().encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    );
  });

  it('is chunk-order independent', async () => {
    const data = new Uint8Array(1_000_003);
    for (let i = 0; i < data.length; i++) {
      data[i] = (i * 31 + 7) & 0xff;
    }
    const whole = new Sha256().update(data).digest();

    const hasher = new Sha256();
    const step = 3333;
    for (let i = 0; i < data.length; i += step) {
      hasher.update(data.subarray(i, i + step));
    }
    expect(Buffer.from(hasher.digest()).toString('hex')).toBe(
      Buffer.from(whole).toString('hex')
    );
  });

  it('keeps async convenience wrapper working', async () => {
    const viaSubtle = await sha256Hex(new TextEncoder().encode('JMFM'));
    expect(viaSubtle).toBe(sha256HexOf(new TextEncoder().encode('JMFM')));
  });
});
