export interface FileSystem {
  mkdir(path: string): Promise<void>;
  /** data may be raw bytes or a base64 string (native/SAF direct-write, avoiding double encode/decode). */
  writeFile(path: string, data: Uint8Array | string): Promise<void>;
  appendFile(path: string, data: Uint8Array | string): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  unlink(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  rename(oldPath: string, newPath: string): Promise<void>;
  /** Size in bytes; -1 when the entry does not exist. */
  size(path: string): Promise<number>;
}
