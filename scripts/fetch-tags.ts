import {AxiosHttpClient} from './shared/axios-http';
import {ApiClient} from '../src/core/api';

const COUNT = Number(process.argv[2] ?? 8);

async function main(): Promise<void> {
  const http = new AxiosHttpClient({
    ...(process.env.JMF_PROXY ? {proxy: process.env.JMF_PROXY} : {}),
    timeoutMs: 15000,
    maxRetries: 3,
  });
  const api = new ApiClient(http);

  console.log('== 今日最新列表 (o=mr_t) ==');
  const {albums, total} = await api.getLatestAlbums(1, {order: 'mr_t'});
  console.log(`第 1 页 ${albums.length} 条，total=${total}，展示前 ${Math.min(COUNT, albums.length)} 本的 tags`);

  // Fetch details serially, spacing requests to avoid source rate limiting
  for (let i = 0; i < Math.min(COUNT, albums.length); i++) {
    const summary = albums[i];
    try {
      const detail = await api.getAlbum(summary.albumId);
      console.log('');
      console.log(`#${summary.albumId} ${summary.name.slice(0, 60)}`);
      console.log(`  作者: ${summary.author || '(未知)'}`);
      console.log(`  章节: ${detail.episodes.length}`);
      console.log(
        `  tags: ${detail.tags.length > 0 ? detail.tags.join(' / ') : '(空)'}`,
      );
    } catch (e) {
      console.log('');
      console.log(`#${summary.albumId} ${summary.name.slice(0, 60)}`);
      console.log(`  获取失败: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (i + 1 < Math.min(COUNT, albums.length)) {
      await new Promise(r => setTimeout(r, 1200));
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
