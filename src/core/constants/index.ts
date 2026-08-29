import {config} from '../../config';

export const SCRAMBLE = {
  SCRAMBLE_220980: 220980,
  SCRAMBLE_268850: 268850,
  SCRAMBLE_421926: 421926,
} as const;

export const HTML_DOMAINS = config.domains.html;
export const CDN_DOMAINS = config.domains.cdn;
export const FALLBACK_CDN = config.domains.fallbackCdn;

export const REQUEST = {
  USER_AGENT: config.request.userAgent,
  REFERER: config.request.referer,
  ACCEPT_IMAGE: config.request.acceptImage,
  CONNECT_TIMEOUT_MS: config.request.connectTimeoutMs,
  READ_TIMEOUT_MS: config.request.readTimeoutMs,
  MAX_RETRIES: config.request.maxRetries,
  RETRY_INTERVAL_MS: config.request.retryIntervalMs,
};

export const DOWNLOAD = {
  CONCURRENCY_MAX: config.download.concurrencyMax,
  CONCURRENCY_MIN: config.download.concurrencyMin,
  CPU_MULTIPLIER: config.download.cpuMultiplier,
};

export const PDF = {
  MAX_WIDTH: config.pdf.maxWidth,
};
