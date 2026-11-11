import {zhCN} from './zh-CN';

export type MessageKey = keyof typeof zhCN;

type Params = Record<string, string | number>;

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (raw, key: string) =>
    key in params ? String(params[key]) : raw
  );
}

export function t(key: MessageKey, params?: Params): string {
  const template: string | undefined = zhCN[key];
  if (template === undefined) {
    if (import.meta.env?.DEV) {
      console.warn(`[i18n] missing key: ${key}`);
    }
    return key;
  }
  return interpolate(template, params);
}
