import {
  HttpMethod, ResponseType, BlazionErrorCode,
  FetchOptions, BlazionConfig, BlazionInterceptors, BlazionRequestConfig, InterceptedResponseData, BlazionError, BlazionErrorParams,
  buildQueryString, mergeHeaders, toHeaderRecord, parseResponseBody, handleResponseError, resolvePayloadAndHeaders, getTimeoutController, resolveFinalSignal,
  BlazionInternalPublic
} from './utils';

export class BlazionInternal implements BlazionInternalPublic {
  public config: BlazionConfig;

  public engineAdapter?: (url: string, config: BlazionRequestConfig, body: BodyInit | null | undefined, rootFetch: typeof fetch) => Promise<Response>;
  public executionWrapper?: <T = InterceptedResponseData>(executor: () => Promise<T>, config: BlazionRequestConfig) => Promise<T>;
  public clearCacheFn?: () => void;
  public readonly installedPlugins = new Set<string>();

  public interceptors: BlazionInterceptors = {
    request: [],
    response: [],
    error: [],
  };

  constructor(config: BlazionConfig) {
    const {
      baseURL = '',
      headers = { 'Accept': 'application/json, text/plain, */*' },
      responseType = ResponseType.JSON,
      ...restConfig
    } = config;

    this.config = { ...restConfig, baseURL, headers, responseType };
  }

  public async request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { baseURL, headers: globalHeaders, timeout: globalTimeout, responseType: globalResponseType } = this.config;

    // --- 1. CONFIGURATION SETUP ---
    if (!endpoint && !baseURL) {
      throw new Error('Target URL of the request is not defined.');
    }
    const initialConfig: BlazionRequestConfig = {
      url: baseURL + endpoint,
      ...options,
      method: (options.method || 'GET').toUpperCase() as HttpMethod,
      headers: mergeHeaders(globalHeaders as HeadersInit, options.headers),
    };

    // --- 8. EXECUTE WITH WRAPPER/ADAPTER ---
    // Re-runs the interceptor pipeline on every invocation, so a plugin that
    // retries this (retry/cache/auth-refresh) always sends a fresh pass —
    // e.g. an auth-refresh plugin's retry picks up a newly-refreshed token.
    const executeAttempt = async (): Promise<T> => {
      // --- 2. REQUEST INTERCEPTOR PIPELINE ---
      let config: BlazionRequestConfig = { ...initialConfig };
      for (const interceptor of this.interceptors.request) {
        config = await interceptor(config);
      }

      const {
        url, query, timeout, responseType, body: rawBody,
        ...customOptions
      } = config;

      // --- 3. RESOLVE RETRY & CACHE CONFIG ---
      const finalTimeout = timeout ?? globalTimeout;

      // --- 5. QUERY PARAMETERS ---
      const qs = buildQueryString(query);
      const finalUrl = qs ? `${url}?${qs}` : url;

      // --- 6. HEADERS ---
      // Normalize via toHeaderRecord first: constructing `new Headers()` directly
      // from a record that has case-varying duplicate keys (e.g. a lowercased
      // global default plus an interceptor re-adding the same header in its
      // original casing) comma-combines them instead of letting the latter win.
      const headers = new Headers(toHeaderRecord(customOptions.headers));

      // --- 7. PAYLOADS & CONTENT-TYPE ---
      const finalBody = resolvePayloadAndHeaders(rawBody, headers);

      const { controller, timeoutSignal, timeoutId } = getTimeoutController(finalTimeout);
      const finalSignal = resolveFinalSignal(finalTimeout, customOptions.signal, controller, timeoutSignal);

      try {
        let response: Response;

        if (this.engineAdapter) {
          response = await this.engineAdapter(finalUrl, { ...config, signal: finalSignal }, finalBody, fetch);
        } else {
          response = await fetch(finalUrl, { ...customOptions, headers, body: finalBody, signal: finalSignal });
        }

        const expectedType = responseType || (globalResponseType as ResponseType);
        let data = await parseResponseBody(response, expectedType);
        handleResponseError(response, expectedType, data, config);

        for (const interceptor of this.interceptors.response) {
          data = await interceptor(data, response);
        }

        return data as Extract<typeof data, T>;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    try {
      if (this.executionWrapper) {
        return await this.executionWrapper(executeAttempt, initialConfig);
      }
      return await executeAttempt();
    } catch (e) {
      let qfError: BlazionError;

      if (e instanceof BlazionError) {
        qfError = e;
      } else {
        const error = e as Error;
        const qfErrorParams: BlazionErrorParams = {
          code: BlazionErrorCode.NETWORK_ERROR,
          message: error.message,
          url: baseURL + endpoint,
          method: options.method || 'GET',
          cause: error,
          config: { url: baseURL + endpoint, ...options }
        };

        if (error.name === 'TimeoutError') {
          qfErrorParams.code = BlazionErrorCode.TIMEOUT;
          qfErrorParams.message = 'Request timed out';
        } else if (error.name === 'AbortError') {
          qfErrorParams.code = BlazionErrorCode.ABORT;
          qfErrorParams.message = 'Request was manually aborted';
        }

        qfError = new BlazionError(qfErrorParams);
      }

      for (const interceptor of this.interceptors.error) {
        await interceptor(qfError);
      }

      throw qfError;
    }
  }

  public clearCache(): void {
    if (this.clearCacheFn) this.clearCacheFn();
  }
}
