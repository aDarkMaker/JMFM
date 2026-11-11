declare module '*.css';

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

interface ImportMetaHot {
  accept(cb?: (mod: unknown) => void): void;
  accept(deps: string | string[], cb?: (mods: unknown) => void): void;
  dispose(cb: () => void): void;
  data: Record<string, unknown>;
  on(event: string, cb: (payload: unknown) => void): void;
}

interface ImportMeta {
  readonly hot?: ImportMetaHot;
}
