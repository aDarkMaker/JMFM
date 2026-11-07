import {create} from 'zustand';

export type NavEntry =
  | {type: 'discover'; params?: {category?: string; order?: string}}
  | {type: 'search'; params?: {query?: string; category?: string}}
  | {type: 'detail'; params: {albumId: number; title?: string}};

interface NavState {
  stack: NavEntry[];
  /** Top entry being animated out; kept mounted until the transition ends. */
  closing: NavEntry | null;
  push(entry: NavEntry): void;
  back(): void;
  reset(): void;
  finishClose(): void;
}

/** Guards against pushing the same screen twice from a double tap. */
function sameEntry(a: NavEntry | undefined, b: NavEntry): boolean {
  if (!a || a.type !== b.type) return false;
  return JSON.stringify(a.params ?? {}) === JSON.stringify(b.params ?? {});
}

export const useNavStore = create<NavState>((set, get) => ({
  stack: [],
  closing: null,

  push(entry) {
    const {stack, closing} = get();
    if (closing || sameEntry(stack[stack.length - 1], entry)) return;
    set({stack: [...stack, entry]});
  },

  back() {
    const {stack, closing} = get();
    if (closing || stack.length === 0) return;
    const top = stack[stack.length - 1];
    set({closing: top});
  },

  reset() {
    set({stack: [], closing: null});
  },

  finishClose() {
    const {stack} = get();
    if (stack.length === 0) {
      set({closing: null});
      return;
    }
    set({stack: stack.slice(0, -1), closing: null});
  },
}));
