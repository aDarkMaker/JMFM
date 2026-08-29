import {CDN_DOMAINS, REQUEST} from '../../core/constants';
import {HttpClient, bytesOf} from '../../core/net';
import {FileSystem} from '../../core/fs/types';
import {atomicWrite} from '../../core/fs/write';

export async function downloadCover(
  http: HttpClient,
  fs: FileSystem,
  albumId: number,
  albumDir: string
): Promise<string | undefined> {
  for (const domain of CDN_DOMAINS) {
    const resp = await http.getBytes(`https://${domain}/media/albums/${albumId}_3x4.jpg`, {
      Referer: REQUEST.REFERER,
      Accept: REQUEST.ACCEPT_IMAGE,
    });
    const bytes = bytesOf(resp);
    if (!resp.ok || !bytes) {
      continue;
    }
    const cover = `${albumDir}/cover.jpg`;
    await atomicWrite(fs, cover, bytes);
    return cover;
  }
  return undefined;
}
