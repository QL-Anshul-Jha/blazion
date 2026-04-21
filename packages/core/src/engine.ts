import {
  HttpMethod, ResponseType, BlazionErrorCode,
  FetchOptions, BlazionConfig, BlazionInterceptors, BlazionRequestConfig, InterceptedResponseData, BlazionError, BlazionErrorParams,
  buildQueryString, mergeHeaders, parseResponseBody, handleResponseError, resolvePayloadAndHeaders, getTimeoutController, resolveFinalSignal,
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

    const executeRequest = async (): Promise<T> => {
      // --- 1. CONFIGURATION SETUP ---
      if (!endpoint && !baseURL) {
        throw new Error('Target URL of the request is not defined.');
      }
      const normalizedMethod = (options.method || 'GET').toUpperCase() as HttpMethod;
      let config: BlazionRequestConfig = {
        url: baseURL + endpoint,
        ...options,
        method: normalizedMethod,
        headers: mergeHeaders(globalHeaders as HeadersInit, options.headers),
      };

      // --- 2. REQUEST INTERCEPTOR PIPELINE ---
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
      const headers = new Headers(customOptions.headers);

      // --- 7. PAYLOADS & CONTENT-TYPE ---
      const finalBody = resolvePayloadAndHeaders(rawBody, headers);

      // --- 8. EXECUTE WITH WRAPPER/ADAPTER ---
      const executeFetch = async (): Promise<T> => {
        const { controller, timeoutSignal, timeoutId } = getTimeoutController(finalTimeout);
        const finalSignal = resolveFinalSignal(finalTimeout, customOptions.signal, controller, timeoutSignal);

        try {
          let response: Response;

          if (this.engineAdapter) {
            response = await this.engineAdapter(finalUrl, { ...config, signal: finalSignal }, finalBody, fetch);
          } else {
            response = await fetch(finalUrl, { ...customOptions, method: normalizedMethod, headers, body: finalBody, signal: finalSignal });
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

      if (this.executionWrapper) {
        return this.executionWrapper(executeFetch, config);
      }

      return executeFetch();
    };

    try {
      return await executeRequest();
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

        if (error.name === 'AbortError') {
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
