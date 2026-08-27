export interface FileSystem {
  mkdir(path: string): Promise<void>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  appendFile(path: string, data: Uint8Array): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  unlink(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
