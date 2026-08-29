import type {PDFDocumentProxy} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {setPageContent} from './pdf-doc';

export interface ScrollViewerCtx {
  scrollAreaRef: {current: HTMLDivElement | null};
  scrollContentRef: {current: HTMLDivElement | null};
  pageCanvasesRef: {current: (HTMLCanvasElement | null)[]};
  docRef: {current: PDFDocumentProxy | null};
  pagesRef: {current: number};
  pageNumRef: {current: number};
  scaleRef: {current: number};
  renderedScaleRef: {current: number};
  currentScrollPageRef: {current: number};
  renderedScrollPagesRef: {current: Set<number>};
  renderSeqRef: {current: number};
  suppressScrollRef: {current: boolean};
  setPage: (p: number) => void;
}

export function getScrollPage(ctx: ScrollViewerCtx): number {
  const area = ctx.scrollAreaRef.current;
  if (!area) return 1;
  const threshold = area.scrollTop + area.clientHeight * 0.3;
  let cur = 1;
  for (let i = 0; i < ctx.pageCanvasesRef.current.length; i++) {
    const c = ctx.pageCanvasesRef.current[i];
    if (c && c.offsetTop <= threshold) {
      cur = i + 1;
    }
  }
  if (area.scrollTop + area.clientHeight >= area.scrollHeight - 4) {
    cur = ctx.pagesRef.current;
  }
  return cur;
}

async function presizeScrollPages(ctx: ScrollViewerCtx, seq: number): Promise<void> {
  const doc = ctx.docRef.current;
  if (!doc) return;
  const first = await doc.getPage(1);
  if (seq !== ctx.renderSeqRef.current) return;
  const vp = first.getViewport({scale: ctx.scaleRef.current});
  const w = `${Math.floor(vp.width)}px`;
  const h = `${Math.floor(vp.height)}px`;
  for (let i = 0; i < ctx.pageCanvasesRef.current.length; i++) {
    const canvas = ctx.pageCanvasesRef.current[i];
    if (canvas) {
      canvas.style.width = w;
      canvas.style.height = h;
    }
  }
}

export async function renderScrollWindow(
  ctx: ScrollViewerCtx,
  center: number,
  seq: number,
  onLowRes?: (page: number) => void
): Promise<void> {
  const doc = ctx.docRef.current;
  if (!doc) return;
  const start = Math.max(1, center - 2);
  const end = Math.min(doc.numPages, center + 3);
  const order: number[] = [];
  for (let d = 0; d <= Math.max(center - start, end - center); d++) {
    const a = center - d;
    if (a >= start) order.push(a);
    const b = center + d;
    if (d > 0 && b <= end) order.push(b);
  }
  for (const i of order) {
    if (ctx.renderedScrollPagesRef.current.has(i)) continue;
    await setPageContent(
      ctx.pageCanvasesRef.current[i - 1],
      ctx.docRef.current,
      i,
      ctx.scaleRef.current,
      seq,
      () => ctx.renderSeqRef.current,
      onLowRes ? () => onLowRes(i) : undefined
    );
    if (seq !== ctx.renderSeqRef.current) return;
    ctx.renderedScrollPagesRef.current.add(i);
  }
}

export async function renderAllPages(
  ctx: ScrollViewerCtx,
  fit: boolean,
  onLayoutChanged?: () => void,
  onLowRes?: (page: number) => void
): Promise<void> {
  const doc = ctx.docRef.current;
  const area = ctx.scrollAreaRef.current;
  if (!doc || !area) return;
  const seq = ++ctx.renderSeqRef.current;
  if (fit) {
    const width = Math.max(area.clientWidth - 24, 240);
    const first = await doc.getPage(1);
    const vp = first.getViewport({scale: 1});
    ctx.scaleRef.current = width / vp.width;
  }
  await presizeScrollPages(ctx, seq);
  if (seq !== ctx.renderSeqRef.current) return;
  onLayoutChanged?.();
  ctx.renderedScrollPagesRef.current.clear();
  await renderScrollWindow(ctx, ctx.pageNumRef.current, seq, onLowRes);
  if (seq !== ctx.renderSeqRef.current) return;
  ctx.renderedScaleRef.current = ctx.scaleRef.current;
}

export function onScrollAreaScroll(ctx: ScrollViewerCtx): void {
  const area = ctx.scrollAreaRef.current;
  if (!area) return;
  if (ctx.suppressScrollRef.current) return;
  const cur = getScrollPage(ctx);
  if (cur !== ctx.currentScrollPageRef.current) {
    ctx.currentScrollPageRef.current = cur;
    ctx.pageNumRef.current = cur;
    ctx.setPage(cur);
  }
}

function rerenderScrollWithAnchor(
  ctx: ScrollViewerCtx,
  render: (onLayoutChanged?: () => void) => Promise<void>,
  focalY?: number
): void {
  const area = ctx.scrollAreaRef.current;
  if (!area) return;
  const oldScale = ctx.renderedScaleRef.current;
  const k = oldScale > 0 ? ctx.scaleRef.current / oldScale : 1;
  const fy = focalY ?? area.clientHeight / 2;
  const anchor = area.scrollTop + fy;
  ctx.suppressScrollRef.current = true;
  void render(() => {
    const w = ctx.scrollContentRef.current;
    if (w) {
      w.style.transform = 'none';
    }
    const a = ctx.scrollAreaRef.current;
    if (a) {
      a.scrollTop = anchor * k - fy;
    }
  })
    .then(() => {
      ctx.suppressScrollRef.current = false;
      onScrollAreaScroll(ctx);
    })
    .catch(() => {
      const w = ctx.scrollContentRef.current;
      if (w) {
        w.style.transform = 'none';
      }
      ctx.suppressScrollRef.current = false;
    });
}

export function scrollToPage(ctx: ScrollViewerCtx, n: number): void {
  const canvas = ctx.pageCanvasesRef.current[n - 1];
  const area = ctx.scrollAreaRef.current;
  if (canvas && area) {
    area.scrollTo({
      top: canvas.offsetTop - 8,
      behavior: 'smooth',
    });
  }
}

export function getScrollFocalY(
  ctx: ScrollViewerCtx,
  touches: {clientY: number}[],
  el: HTMLElement
): number {
  const rect = el.getBoundingClientRect();
  const midY = (touches[0].clientY + touches[1].clientY) / 2;
  return midY - rect.top;
}

export function applyScrollScaleTransform(
  ctx: ScrollViewerCtx,
  s: number,
  st: {baseScrollTop: number; focalY: number} | null
): void {
  const wrapper = ctx.scrollContentRef.current;
  if (!wrapper) return;
  const k = s / ctx.renderedScaleRef.current;
  if (st) {
    const t = (1 - k) * (st.baseScrollTop + st.focalY);
    wrapper.style.transform = `translateY(${t}px) scale(${k})`;
  } else {
    wrapper.style.transform = `scale(${k})`;
  }
}

export function resetScrollScaleTransform(ctx: ScrollViewerCtx): void {
  const wrapper = ctx.scrollContentRef.current;
  if (wrapper) {
    wrapper.style.transform = 'none';
  }
}

export function scaleScrollWithAnchor(
  ctx: ScrollViewerCtx,
  render: (onLayoutChanged?: () => void) => Promise<void>,
  focalY?: number
): void {
  rerenderScrollWithAnchor(ctx, render, focalY);
}
