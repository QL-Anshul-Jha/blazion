import { HttpMethod, ResponseType, QuokkaErrorCode } from './enums';

export type JSONPrimitive = string | number | boolean | null;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export type RequestPayload = JSONValue | BodyInit | null;

export type FetchOptions = Omit<RequestInit, 'method' | 'body'> & {
  method?: HttpMethod;
  query?: QueryParams;
  body?: RequestPayload;
  timeout?: number;
  responseType?: ResponseType;
};

export interface QuokkaRequestConfig extends FetchOptions {
  url: string;
}

export type InterceptedResponseData = JSONValue | Blob | ArrayBuffer | FormData | string;

export interface QuokkaInterceptors {
  request: Array<(config: QuokkaRequestConfig) => QuokkaRequestConfig | Promise<QuokkaRequestConfig>>;
  response: Array<(data: InterceptedResponseData, response: Response) => InterceptedResponseData | Promise<InterceptedResponseData>>;
  error: Array<(error: Error) => Promise<void> | void>;
}

export type QuokkaFetchConfig = {
  baseURL?: string;
  headers?: HeadersInit;
  responseType?: ResponseType;
};

export interface QuokkaRequestPayload extends Omit<FetchOptions, 'method' | 'body'> {
  url: string;
  method: HttpMethod | string;
  payload?: RequestPayload;
  params?: QueryParams;
}

export interface QuokkaCallable {
  <T = JSONValue>(payload: QuokkaRequestPayload): Promise<T>;
  
  // Fluent Event Hooks
  onRequest(handler: (config: QuokkaRequestConfig) => QuokkaRequestConfig | Promise<QuokkaRequestConfig>): this;
  onResponse(handler: (data: InterceptedResponseData, response: Response) => InterceptedResponseData | Promise<InterceptedResponseData>): this;
  onError(handler: (error: Error) => Promise<void> | void): this;
}

export interface QuokkaFetchErrorParams {
  code: QuokkaErrorCode;
  message: string;
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  data?: JSONValue;
  headers?: Record<string, string>;
  cause?: Error;
  config: QuokkaRequestConfig;
  raw?: JSONValue;
}

export class QuokkaFetchError extends Error {
  public override name: string = 'QuokkaFetchError';
  public code: QuokkaErrorCode;
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

  constructor(params: QuokkaFetchErrorParams) {
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

    // Retryable logic
    this.isTimeoutError = params.code === QuokkaErrorCode.TIMEOUT;
    this.isNetworkError = params.code === QuokkaErrorCode.NETWORK_ERROR;
    this.isAbortError = params.code === QuokkaErrorCode.ABORT;
    this.retryable = this.isTimeoutError || (this.isNetworkError && params.method === 'GET') || (!!this.status && this.status >= 500);

    // Properly capture stack trace for V8 engines (Chrome/Node)
    const v8Error = Error as { captureStackTrace?: (target: object, constructor?: typeof QuokkaFetchError) => void };
    if (v8Error.captureStackTrace) {
      v8Error.captureStackTrace(this, QuokkaFetchError);
    }
  }
}

