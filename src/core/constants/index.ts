import {config} from '../../config';

export const SCRAMBLE = {
  SCRAMBLE_220980: 220980,
  SCRAMBLE_268850: 268850,
  SCRAMBLE_421926: 421926,
} as const;

export const PROGRESS = {
  START: 0,
  ALBUM_PARSED: 20,
  CHAPTER_PARSED: 40,
  IMAGE_DOWNLOAD_START: 50,
  IMAGE_DOWNLOAD_END: 70,
  PDF_START: 75,
  PDF_END: 95,
  DONE: 100,
} as const;

export const APP = {
  APP_VERSION: config.app.version,
  APP_TOKEN_SECRET: config.app.tokenSecret,
  APP_TOKEN_SECRET_2: config.app.tokenSecret2,
  APP_DATA_SECRET: config.app.dataSecret,
  API_DOMAIN_SERVER_SECRET: config.app.domainServerSecret,
};

export const HTML_DOMAINS = config.domains.html;
export const CDN_DOMAINS = config.domains.cdn;
export const API_DOMAINS = config.domains.api;
export const FALLBACK_CDN = config.domains.fallbackCdn;
export const API_DOMAIN_SERVERS = config.domains.apiDomainServers;

export const REQUEST = {
  USER_AGENT: config.request.userAgent,
  USER_AGENT_MOBILE: config.request.userAgentMobile,
  REFERER: config.request.referer,
  ACCEPT_IMAGE: config.request.acceptImage,
  ACCEPT_API: config.request.acceptApi,
  ACCEPT_ENCODING: config.request.acceptEncoding,
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
  PAGE_WIDTH_PT: config.pdf.pageWidthPt,
  PAGE_HEIGHT_PT: config.pdf.pageHeightPt,
  MAX_WIDTH: config.pdf.maxWidth,
  MAX_HEIGHT: config.pdf.maxHeight,
  TITLE_MAX_LEN: config.pdf.titleMaxLen,
  BACKGROUND: config.pdf.backgroundColor,
};
