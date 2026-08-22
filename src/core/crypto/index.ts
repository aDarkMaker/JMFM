import CryptoJS from 'crypto-js';

export function md5Hex(input: string): string {
  return CryptoJS.MD5(input).toString(CryptoJS.enc.Hex);
}

/**
 * Decrypt AES-ECB ciphertext.
 * jmcomic derives the key as `md5Hex(ts + secret)` then encodes it as
 * UTF-8 ASCII (32 bytes, AES-256). The ciphertext is base64.
 */
export function aesEcbDecrypt(data: string, key: string): string {
  const keyHex = CryptoJS.enc.Utf8.parse(md5Hex(key));
  const decrypted = CryptoJS.AES.decrypt(data, keyHex, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}
