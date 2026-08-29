import {FileSystem} from './types';

/** Lower bound for a valid page/cover/meta file; anything smaller is a half-written file. */
export const MIN_FILE_BYTES = 64;

export async function atomicWrite(
  fs: FileSystem,
  path: string,
  data: Uint8Array | string
): Promise<void> {
  const tmp = `${path}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, path);
}
