import { HttpMethod, ResponseType, BlazionErrorCode } from './enums';

export type JSONPrimitive = string | number | boolean | null;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

// **BodyInit** is the **complete union type** for **all valid fetch` request bodies**
export type RequestPayload = JSONValue | BodyInit | null;

export interface ProgressEventData {
  loaded: number;
  total: number;
  progress: number;
}

export interface BlazionFeatureOptions {
  retry?: number;
  retryDelay?: number;
  qCache?: boolean;
  qCacheTime?: number;
  onUploadProgress?: (event: ProgressEventData) => void;
  onDownloadProgress?: (event: ProgressEventData) => void;
}

// Used for overriding individual request options
export type FetchOptions = Omit<RequestInit, 'method' | 'body'> & BlazionFeatureOptions & {
  method?: HttpMethod;
  query?: QueryParams;
  body?: RequestPayload;
  timeout?: number;
  responseType?: ResponseType;
};

export interface BlazionRequestConfig extends FetchOptions {
  url: string;
}

export type InterceptedResponseData = JSONValue | Blob | ArrayBuffer | FormData | string;

export interface BlazionInterceptors {
  request: Array<(config: BlazionRequestConfig) => BlazionRequestConfig | Promise<BlazionRequestConfig>>;
  response: Array<(data: InterceptedResponseData, response: Response) => InterceptedResponseData | Promise<InterceptedResponseData>>;
  error: Array<(error: Error) => Promise<void> | void>;
}

// Used for initializing the Blazion instance : Config
export interface BlazionConfig extends BlazionFeatureOptions {
  baseURL?: string;
  headers?: HeadersInit;
  responseType?: ResponseType;
  timeout?: number;
}

export interface BlazionRequestPayload extends Omit<FetchOptions, 'method' | 'body'> {
  url: string;
  method?: HttpMethod;
  payload?: RequestPayload;
  params?: QueryParams;
}

export interface BlazionCallable {
  <T = JSONValue>(payload: BlazionRequestPayload): Promise<T>;

  // Fluent Event Hooks
  onRequest(handler: (config: BlazionRequestConfig) => BlazionRequestConfig | Promise<BlazionRequestConfig>): this;
  onResponse(handler: (data: InterceptedResponseData, response: Response) => InterceptedResponseData | Promise<InterceptedResponseData>): this;
  onError(handler: (error: Error) => Promise<void> | void): this;

  // Cache Management
  clearCache(): void;
}

export interface BlazionErrorParams {
  code: BlazionErrorCode;
  message: string;
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  data?: JSONValue;
  headers?: Record<string, string>;
  cause?: Error;
  config: BlazionRequestConfig;
  raw?: JSONValue;
}

export interface CacheEntry {
  data: InterceptedResponseData;
  timestamp: number;
  ttl: number;
}

export class BlazionError extends Error {
  public override name: string = 'BlazionError';
  public code: BlazionErrorCode;
  public status?: number;
  public statusText?: string;
  public details: JSONValue;
  public timestamp: string;
  public requestId: string;
  public url: string;
  public method: string;
  public headers: Record<string, string>;
  public cause?: Error;
  public retryable: boolean;
  public isNetworkError: boolean;
  public isTimeoutError: boolean;
  public isAbortError: boolean;
  public raw?: JSONValue;
  public config: BlazionRequestConfig;

  constructor(params: BlazionErrorParams) {
    super(params.message);
    this.code = params.code;
    this.status = params.status;
    this.statusText = params.statusText;
    this.details = params.data || null;
    this.timestamp = new Date().toISOString();
    this.requestId = Math.random().toString(36).substring(7).toUpperCase();
    this.url = params.url;
    this.method = params.method;
    this.headers = params.headers || {};
    this.cause = params.cause;
    this.raw = params.raw;
    this.config = params.config;

    // Retryable logic
    this.isTimeoutError = params.code === BlazionErrorCode.TIMEOUT;
    this.isNetworkError = params.code === BlazionErrorCode.NETWORK_ERROR;
    this.isAbortError = params.code === BlazionErrorCode.ABORT;
    this.retryable = this.isTimeoutError || (this.isNetworkError && params.method === 'GET') || (!!this.status && this.status >= 500);

    // Properly capture stack trace for V8 engines (Chrome/Node)
    const v8Error = Error as { captureStackTrace?: (target: object, constructor?: typeof BlazionError) => void };
    if (v8Error.captureStackTrace) {
      v8Error.captureStackTrace(this, BlazionError);
    }
  }
}
