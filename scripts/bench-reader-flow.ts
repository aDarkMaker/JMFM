import {readdirSync, readFileSync, statSync, existsSync, writeFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

interface Strategy {
  name: string;
  back: number;
  front: number;
  decodeConcurrency: number;
  warmAhead: number;
  prewarmPages: number;
}

interface Perc {
  p50: number;
  p95: number;
  max: number;
}

interface StrategyResult {
  name: string;
  metaMs: number;
  firstPaintMs: number;
  firstScrollMs: number;
  scrollTotalMs: number;
  windowMountCount: number;
  ioReadMs: number;
  decodeMs: Perc;
  enterDecodeSamples: number;
}

const IMAGE_RE = /\.(jpe?g|png|webp)$/i;

const STRATEGIES: Strategy[] = [
  {name: 'current_pm1_p3_c2', back: 1, front: 3, decodeConcurrency: 2, warmAhead: 4, prewarmPages: 0},
  {name: 'smaller_pm1_p2_c1', back: 1, front: 2, decodeConcurrency: 1, warmAhead: 2, prewarmPages: 0},
  {name: 'prewarm12_pm1_p3_c2', back: 1, front: 3, decodeConcurrency: 2, warmAhead: 4, prewarmPages: 12},
];

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}

function perc(values: number[]): Perc {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    max: Math.round(sorted[sorted.length - 1] ?? 0),
  };
}

function findAlbumRoot(albumId: string): {albumDir: string; pagesDir: string; pdfPath: string} {
  const temp = join(process.cwd(), 'temp');
  const argPath = process.argv[3];
  if (argPath && existsSync(argPath)) {
    const pagesDir = argPath.endsWith('pages') ? argPath : join(argPath, 'pages');
    const albumDir = dirname(pagesDir);
    const pdf = readdirSync(albumDir).find(n => n.endsWith('.pdf'));
    return {albumDir, pagesDir, pdfPath: pdf ? join(albumDir, pdf) : ''};
  }
  const dirs = readdirSync(temp, {withFileTypes: true}).filter(d => d.isDirectory());
  for (const d of dirs) {
    const albumDir = join(temp, d.name);
    const pagesDir = join(albumDir, 'pages');
    if (!existsSync(pagesDir)) continue;
    const pdf = readdirSync(albumDir).find(n => n.endsWith('.pdf'));
    if (albumId === 'auto' || d.name.includes(albumId) || existsSync(join(temp, `${albumId}_cover.jpg`))) {
      return {albumDir, pagesDir, pdfPath: pdf ? join(albumDir, pdf) : ''};
    }
  }
  if (dirs.length === 1) {
    const albumDir = join(temp, dirs[0].name);
    const pagesDir = join(albumDir, 'pages');
    const pdf = readdirSync(albumDir).find(n => n.endsWith('.pdf'));
    return {albumDir, pagesDir, pdfPath: pdf ? join(albumDir, pdf) : ''};
  }
  throw new Error(`pages dir not found in temp/ (album=${albumId})`);
}

function listPages(pagesDir: string): string[] {
  return readdirSync(pagesDir)
    .filter(n => IMAGE_RE.test(n))
    .sort((a, b) => (Number.parseInt(a, 10) || 0) - (Number.parseInt(b, 10) || 0))
    .map(n => join(pagesDir, n));
}

function decodeCost(path: string, displayWidth = 400): {ioMs: number; decodeMs: number} {
  const t0 = performance.now();
  const buf = readFileSync(path);
  const ioMs = performance.now() - t0;
  const t1 = performance.now();
  const r = spawnSync(
    'magick',
    [path, '-resize', `${displayWidth}x`, '-quality', '85', 'null:'],
    {encoding: 'utf8'},
  );
  if (r.status !== 0) {
    throw new Error(`decode failed: ${r.stderr || path}`);
  }
  const decodeMs = performance.now() - t1;
  void buf;
  return {ioMs, decodeMs};
}

async function runStrategy(paths: string[], strategy: Strategy): Promise<StrategyResult> {
  const tMeta0 = performance.now();
  const pageCount = paths.length;
  const metaMs = performance.now() - tMeta0;

  const decoded = new Set<number>();
  const decodeSamples: number[] = [];
  let ioReadMs = 0;
  let windowMountCount = 0;
  let active = 0;
  const queue: number[] = [];

  const pump = async (): Promise<void> => {
    const jobs: Promise<void>[] = [];
    while (active < strategy.decodeConcurrency && queue.length > 0) {
      const i = queue.shift()!;
      if (decoded.has(i) || i < 0 || i >= pageCount) continue;
      active += 1;
      jobs.push(
        (async () => {
          const {ioMs, decodeMs} = decodeCost(paths[i]);
          ioReadMs += ioMs;
          decodeSamples.push(decodeMs);
          decoded.add(i);
          active -= 1;
        })(),
      );
    }
    if (jobs.length) await Promise.all(jobs);
    if (queue.length) await pump();
  };

  const enqueue = async (indices: number[]) => {
    for (const i of indices) {
      if (i < 0 || i >= pageCount || decoded.has(i) || queue.includes(i)) continue;
      queue.push(i);
    }
    await pump();
  };

  let window = {start: -1, end: -1};
  const ensureWindow = async (cur: number) => {
    const wantStart = Math.max(0, cur - strategy.back);
    const wantEnd = Math.min(pageCount, cur + strategy.front + 1);
    let start = window.start;
    let end = window.end;
    if (start < 0) {
      start = wantStart;
      end = wantEnd;
    } else {
      if (cur - 1 < start) start = wantStart;
      if (cur + 1 >= end) end = wantEnd;
      start = Math.max(0, Math.min(start, wantStart));
      end = Math.min(pageCount, Math.max(end, wantEnd));
    }
    if (start !== window.start || end !== window.end) {
      window = {start, end};
      windowMountCount += 1;
      const need: number[] = [];
      for (let i = start; i < end; i++) need.push(i);
      for (let k = 0; k < strategy.warmAhead; k++) need.push(end + k);
      await enqueue(need);
    } else {
      const need: number[] = [];
      for (let k = 0; k < strategy.warmAhead; k++) need.push(end + k);
      await enqueue(need);
    }
  };

  const tFirst0 = performance.now();
  await enqueue([0]);
  const firstPaintMs = performance.now() - tFirst0;

  if (strategy.prewarmPages > 0) {
    const warm = Array.from({length: Math.min(strategy.prewarmPages, pageCount)}, (_, i) => i);
    await enqueue(warm);
  }

  const tScroll0 = performance.now();
  let firstScrollMs = 0;
  for (let cur = 0; cur < pageCount; cur++) {
    const tEnter = performance.now();
    await ensureWindow(cur);
    if (cur === 1) {
      firstScrollMs = performance.now() - tEnter;
    }
  }
  const scrollTotalMs = performance.now() - tScroll0;

  return {
    name: strategy.name,
    metaMs: Math.round(metaMs),
    firstPaintMs: Math.round(firstPaintMs),
    firstScrollMs: Math.round(firstScrollMs),
    scrollTotalMs: Math.round(scrollTotalMs),
    windowMountCount,
    ioReadMs: Math.round(ioReadMs),
    decodeMs: perc(decodeSamples),
    enterDecodeSamples: decodeSamples.length,
  };
}

async function benchPdf(pdfPath: string): Promise<number> {
  if (!pdfPath || !existsSync(pdfPath)) return -1;
  const t0 = performance.now();
  const data = new Uint8Array(readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({data, useSystemFonts: true}).promise;
  await doc.getPage(1);
  const anyDoc = doc as unknown as {destroy?: () => Promise<void>; cleanup?: () => void};
  if (typeof anyDoc.destroy === 'function') {
    await anyDoc.destroy();
  } else if (typeof anyDoc.cleanup === 'function') {
    anyDoc.cleanup();
  }
  return Math.round(performance.now() - t0);
}

async function main(): Promise<void> {
  const albumId = process.argv[2] ?? '1214052';
  const {albumDir, pagesDir, pdfPath} = findAlbumRoot(albumId);
  console.log(`[bench] albumDir=${albumDir}`);
  console.log(`[bench] pagesDir=${pagesDir}`);
  console.log(`[bench] pdfPath=${pdfPath || '(none)'}`);

  const tList0 = performance.now();
  const paths = listPages(pagesDir);
  const listMs = performance.now() - tList0;
  let totalBytes = 0;
  for (const p of paths) totalBytes += statSync(p).size;
  console.log(
    `[bench] pages=${paths.length} totalBytes=${totalBytes} avgBytes=${Math.round(totalBytes / Math.max(1, paths.length))} listMs=${listMs.toFixed(1)}`,
  );

  const pdfOpenMs = await benchPdf(pdfPath);
  console.log(`[bench] pdfOpenMs=${pdfOpenMs}`);

  const results: StrategyResult[] = [];
  for (const s of STRATEGIES) {
    console.log(`[bench] strategy=${s.name} ...`);
    const r = await runStrategy(paths, s);
    results.push(r);
    console.log(
      `[bench] ${s.name}: firstPaint=${r.firstPaintMs}ms firstScroll=${r.firstScrollMs}ms scrollTotal=${r.scrollTotalMs}ms mounts=${r.windowMountCount} decode(p50/p95/max)=${r.decodeMs.p50}/${r.decodeMs.p95}/${r.decodeMs.max} io=${r.ioReadMs}ms`,
    );
  }

  const ranked = [...results].sort((a, b) => {
    const score = (r: StrategyResult) => r.firstScrollMs * 3 + r.scrollTotalMs + r.firstPaintMs;
    return score(a) - score(b);
  });
  const winner = ranked[0];

  const report = {
    albumId,
    albumDir,
    pagesDir,
    pageCount: paths.length,
    pagesTotalBytes: totalBytes,
    pagesAvgBytes: Math.round(totalBytes / Math.max(1, paths.length)),
    listMs: Math.round(listMs),
    pdfOpenMs,
    strategies: results,
    winner: winner.name,
    recommendation: {
      back: STRATEGIES.find(s => s.name === winner.name)!.back,
      front: STRATEGIES.find(s => s.name === winner.name)!.front,
      decodeConcurrency: STRATEGIES.find(s => s.name === winner.name)!.decodeConcurrency,
      warmAhead: STRATEGIES.find(s => s.name === winner.name)!.warmAhead,
      prewarmPages: STRATEGIES.find(s => s.name === winner.name)!.prewarmPages,
    },
  };

  const out = join(process.cwd(), 'temp', `bench-reader-${albumId}.json`);
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`[bench] winner=${winner.name}`);
  console.log(`[bench] wrote ${out}`);
  console.log(JSON.stringify(report.recommendation, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
