export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy so the buffer is a plain ArrayBuffer accepted by subtle.digest.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
