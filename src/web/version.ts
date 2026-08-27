declare const __APP_VERSION__: string;

export function appVersionFallback(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
}
