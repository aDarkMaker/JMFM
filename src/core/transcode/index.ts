import {md5Hex} from '../crypto';
import {SCRAMBLE} from '../constants';

export function getNum(scrambleId: number, aid: number, fileName: string): number {
  if (aid < scrambleId) {
    return 0;
  }
  if (aid < SCRAMBLE.SCRAMBLE_268850) {
    return 10;
  }
  const x = aid < SCRAMBLE.SCRAMBLE_421926 ? 10 : 8;
  const s = md5Hex(`${aid}${fileName}`);
  const v = s.charCodeAt(s.length - 1) % x * 2 + 2;
  return v;
}

export interface Strip {
  ySrc: number;
  yDst: number;
  height: number;
}

export function computeStrips(num: number, height: number): Strip[] {
  const over = height % num;
  const base = Math.floor(height / num);
  const strips: Strip[] = [];
  for (let i = 0; i < num; i++) {
    let move = base;
    let ySrc = height - base * (i + 1) - over;
    let yDst = base * i;
    if (i === 0) {
      move += over;
    } else {
      yDst += over;
    }
    if (ySrc < 0) {
      ySrc = 0;
    }
    if (ySrc + move > height) {
      move = height - ySrc;
    }
    strips.push({ySrc, yDst, height: move});
  }
  return strips;
}
