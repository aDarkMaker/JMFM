import appConfig from './app-config.json';

export interface AppConfig {
  domains: {
    html: string[];
    api: string[];
    cdn: string[];
    fallbackCdn: string;
    apiDomainServers: string[];
  };
  app: {
    version: string;
    tokenSecret: string;
    tokenSecret2: string;
    dataSecret: string;
    domainServerSecret: string;
  };
  request: {
    userAgent: string;
    userAgentMobile: string;
    referer: string;
    acceptImage: string;
    acceptApi: string;
    acceptEncoding: string;
    connectTimeoutMs: number;
    readTimeoutMs: number;
    maxRetries: number;
    retryIntervalMs: number;
  };
  download: {
    concurrencyMax: number;
    concurrencyMin: number;
    cpuMultiplier: number;
  };
  pdf: {
    pageWidthPt: number;
    pageHeightPt: number;
    maxWidth: number;
    maxHeight: number;
    titleMaxLen: number;
    backgroundColor: string;
  };
}

export const config: AppConfig = appConfig;
