import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {setPageContent} from './pdf-doc';
import {BackPageCache, FLIP_DURATION_MS} from './types';

export interface PagedViewerCtx {
  pagedAreaRef: {current: HTMLDivElement | null};
  frontRef: {current: HTMLCanvasElement | null};
  backRef: {current: HTMLCanvasElement | null};
  docRef: {current: pdfjs.PDFDocumentProxy | null};
  pageNumRef: {current: number};
  scaleRef: {current: number};
  renderedScaleRef: {current: number};
  renderSeqRef: {current: number};
  backPageRef: {current: BackPageCache | null};
  animatingRef: {current: boolean};
  mountedRef: {current: boolean};
  setError: (e: string | null) => void;
  setPage: (p: number) => void;
}

export function positionCanvas(
  area: HTMLDivElement | null,
  canvas: HTMLCanvasElement | null
): void {
  if (!area || !canvas) return;
  const w = canvas.offsetWidth || parseInt(canvas.style.width, 10) || 0;
  const h = canvas.offsetHeight || parseInt(canvas.style.height, 10) || 0;
  canvas.style.left = `${Math.max((area.clientWidth - w) / 2, 0)}px`;
  canvas.style.top = `${Math.max((area.clientHeight - h) / 2, 0)}px`;
}

function swapCanvases(ctx: PagedViewerCtx, opts?: {outgoingTransform?: string}): void {
  const front = ctx.frontRef.current;
  const back = ctx.backRef.current;
  if (!front || !back) return;
  const outgoing = front;
  const incoming = back;
  outgoing.style.transition = 'none';
  outgoing.style.visibility = 'hidden';
  outgoing.style.transform = opts?.outgoingTransform ?? 'none';
  incoming.style.transition = 'none';
  incoming.style.transform = 'none';
  incoming.style.visibility = 'visible';
  incoming.style.zIndex = '';
  outgoing.style.zIndex = '';
  ctx.frontRef.current = incoming;
  ctx.backRef.current = outgoing;
}

export async function prefetchNext(ctx: PagedViewerCtx, n: number): Promise<void> {
  const seq = ctx.renderSeqRef.current;
  const back = ctx.backRef.current;
  const total = ctx.docRef.current?.numPages ?? 0;
  if (!back || n >= total) return;
  await setPageContent(
    back,
    ctx.docRef.current,
    n + 1,
    ctx.scaleRef.current,
    seq,
    () => ctx.renderSeqRef.current
  );
  back.style.visibility = 'hidden';
  ctx.backPageRef.current = {page: n + 1, scale: ctx.scaleRef.current};
}

export async function reRenderPaged(ctx: PagedViewerCtx): Promise<void> {
  if (ctx.animatingRef.current || !ctx.mountedRef.current) return;
  const seq = ++ctx.renderSeqRef.current;
  const back = ctx.backRef.current;
  const front = ctx.frontRef.current;
  if (!back || !front) return;
  try {
    const outgoingTransform = front.style.transform || 'none';
    back.style.transition = 'none';
    back.style.transform = 'none';
    back.style.visibility = 'hidden';
    const oldScale = ctx.renderedScaleRef.current;
    await setPageContent(
      back,
      ctx.docRef.current,
      ctx.pageNumRef.current,
      ctx.scaleRef.current,
      seq,
      () => ctx.renderSeqRef.current
    );
    if (!ctx.mountedRef.current || seq !== ctx.renderSeqRef.current) return;
    positionCanvas(ctx.pagedAreaRef.current, back);
    swapCanvases(ctx, {outgoingTransform});
    ctx.backPageRef.current = {page: ctx.pageNumRef.current, scale: oldScale};
    positionCanvas(ctx.pagedAreaRef.current, ctx.frontRef.current);
    ctx.renderedScaleRef.current = ctx.scaleRef.current;
    void prefetchNext(ctx, ctx.pageNumRef.current);
  } catch (e) {
    ctx.setError(e instanceof Error ? e.message : String(e));
  }
}

export async function flipPaged(ctx: PagedViewerCtx, n: number, dir: 1 | -1): Promise<void> {
  const front = ctx.frontRef.current;
  const back = ctx.backRef.current;
  const area = ctx.pagedAreaRef.current;
  if (!front || !back || !area || ctx.animatingRef.current) return;
  ctx.animatingRef.current = true;
  const seq = ++ctx.renderSeqRef.current;
  const prevOverflow = area.style.overflow;
  try {
    const cached = ctx.backPageRef.current;
    if (!cached || cached.page !== n || cached.scale !== ctx.scaleRef.current) {
      await setPageContent(
        back,
        ctx.docRef.current,
        n,
        ctx.scaleRef.current,
        seq,
        () => ctx.renderSeqRef.current
      );
      if (seq !== ctx.renderSeqRef.current) return;
    }
    const oldPage = ctx.pageNumRef.current;
    positionCanvas(area, back);
    area.style.overflow = 'hidden';
    front.style.transition = 'none';
    back.style.transition = 'none';
    back.style.zIndex = '2';
    front.style.zIndex = '1';
    back.style.visibility = 'hidden';
    back.style.transform = `translate3d(${dir * 100}%, 0, 0)`;
    void back.offsetWidth;
    back.style.visibility = 'visible';
    ctx.pageNumRef.current = n;
    ctx.setPage(n);

    const easing = 'cubic-bezier(0.25, 0.1, 0.25, 1)';
    const backAnim = back.animate(
      [{transform: `translate3d(${dir * 100}%, 0, 0)`}, {transform: 'translate3d(0, 0, 0)'}],
      {duration: FLIP_DURATION_MS, easing, fill: 'both'}
    );
    const frontAnim = front.animate(
      [{transform: 'translate3d(0, 0, 0)'}, {transform: `translate3d(${-dir * 100}%, 0, 0)`}],
      {duration: FLIP_DURATION_MS, easing, fill: 'both'}
    );
    await Promise.all([backAnim.finished, frontAnim.finished].map((p) => p.catch(() => {})));
    if (!ctx.mountedRef.current || seq !== ctx.renderSeqRef.current) return;
    try {
      backAnim.commitStyles();
      frontAnim.commitStyles();
    } catch {
      // older WebViews lack commitStyles; manual terminal state below still applies
    }
    backAnim.cancel();
    frontAnim.cancel();
    back.style.transform = 'none';
    ctx.pageNumRef.current = n;
    ctx.backPageRef.current = {page: oldPage, scale: ctx.scaleRef.current};
    swapCanvases(ctx, {outgoingTransform: `translate3d(${-dir * 100}%, 0, 0)`});
    positionCanvas(area, ctx.frontRef.current);
    void prefetchNext(ctx, n);
  } catch (e) {
    ctx.setError(e instanceof Error ? e.message : String(e));
  } finally {
    area.style.overflow = prevOverflow;
    ctx.animatingRef.current = false;
  }
}
