export interface PageSize {
  width: number;
  height: number;
}

export function computeUniformWidth(widths: number[], maxWidth: number): number {
  if (widths.length === 0) {
    return maxWidth;
  }
  return Math.min(Math.max(...widths), maxWidth);
}

export function scaleSize(
  width: number,
  height: number,
  targetWidth: number,
): PageSize {
  const scale = width > 0 ? targetWidth / width : 1;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
