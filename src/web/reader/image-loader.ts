function markReady(img: HTMLImageElement): void {
  img.classList.remove('is-loading');
  img.classList.add('is-ready');
  img.classList.remove('is-error');
}

function markError(img: HTMLImageElement): void {
  img.classList.remove('is-loading');
  img.classList.remove('is-ready');
  img.classList.add('is-error');
}

export function applyToImg(img: HTMLImageElement, url: string): void {
  if (!url) return;
  if (img.dataset.src === url && img.complete && img.naturalWidth > 0) {
    markReady(img);
    return;
  }
  img.dataset.src = url;
  img.classList.add('is-loading');
  img.classList.remove('is-ready', 'is-error');
  img.onload = () => {
    markReady(img);
  };
  img.onerror = () => {
    markError(img);
  };
  img.src = url;
  if (img.complete && img.naturalWidth > 0) {
    markReady(img);
  }
}
