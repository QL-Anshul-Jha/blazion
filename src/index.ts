import { HttpMethod, ResponseType, QuokkaErrorCode } from './utils/enums';
import { FetchOptions, JSONValue, QuokkaFetchConfig, QuokkaInterceptors, QuokkaRequestConfig, InterceptedResponseData, QuokkaCallable, QuokkaRequestPayload, QuokkaFetchError } from './utils/types';
import { buildQueryString, mergeHeaders, parseResponseBody, handleResponseError, resolvePayloadAndHeaders, getTimeoutController, resolveFinalSignal } from './utils/helpers';
import { QuokkaCache } from './utils/cache';
import { executeWithRetry } from './utils/retry';

export * from './utils/types';
export * from './utils/enums';

// Default constants
const DEFAULT_RETRY_COUNT = 0;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_CACHE_TIME = 300000; // 5 minutes

class QuokkaFetchInternal {
  private baseURL: string;
  private defaultHeaders: HeadersInit;
  private defaultResponseType: ResponseType;
  private retryCount: number;
  private retryDelay: number;
  private cacheEnabled: boolean;
  private cacheTime: number;
  private cache = new QuokkaCache();

  public interceptors: QuokkaInterceptors = {
    request: [],
    response: [],
    error: [],
  };

  constructor(config?: QuokkaFetchConfig) {
    this.baseURL = config?.baseURL || '';
    this.defaultHeaders = config?.headers || {
      'Accept': 'application/json, text/plain, */*',
    };
    this.defaultResponseType = config?.responseType || ResponseType.JSON;
    this.retryCount = config?.retry ?? DEFAULT_RETRY_COUNT;
    this.retryDelay = config?.retryDelay ?? DEFAULT_RETRY_DELAY;
    this.cacheEnabled = config?.qCache ?? false;
    this.cacheTime = config?.qCacheTime ?? DEFAULT_CACHE_TIME;
  }

  public async request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {

    // --- 1. CONFIGURATION SETUP ---
    // Merge the base URL with the requested endpoint and merge headers early
    // so interceptors can see the full resolved headers
    let config: QuokkaRequestConfig = {
      url: this.baseURL + endpoint,
      ...options,
      headers: mergeHeaders(this.defaultHeaders, options.headers),
    };

    // --- 2. REQUEST INTERCEPTOR PIPELINE ---
    // Pass the config through sequentially stacked developer-defined Hooks
    for (const interceptor of this.interceptors.request) {
      config = await interceptor(config);
    }

    const { url, query, timeout, responseType, body: rawBody, retry, retryDelay, qCache, qCacheTime, ...customOptions } = config;

    // --- 3. RESOLVE RETRY & CACHE CONFIG ---
    // Priority: Request-level > Instance-level > Library default
    const finalRetryCount = retry ?? this.retryCount;
    const finalRetryDelay = retryDelay ?? this.retryDelay;
    const isCacheEnabled = qCache ?? this.cacheEnabled;
    const finalCacheTime = qCacheTime ?? this.cacheTime;
    const method = customOptions.method || HttpMethod.GET;

    // --- 4. CACHE CHECK (before network) ---
    // Only cache GET requests to avoid stale mutation data
    if (isCacheEnabled && method === HttpMethod.GET) {
      const cacheKey = this.cache.generateKey(method, url, query);
      const cachedData = this.cache.get(cacheKey);
      if (cachedData !== undefined) return cachedData as T;
    }

    // --- 5. QUERY PARAMETERS ---
    // Format JSON object dictionaries gracefully into URL search param notation
    const qs = buildQueryString(query);
    const finalUrl = qs ? `${url}?${qs}` : url;

    // --- 6. HEADERS (already merged in step 1, use from config) ---
    const headers = new Headers(customOptions.headers);

    // --- 7. PAYLOADS & CONTENT-TYPE ---
    // Filter the payload across Native definitions to dynamically resolve Content-Type tracking
    const finalBody = resolvePayloadAndHeaders(rawBody, headers);

    // --- 8. EXECUTE WITH RETRY ---
    // Wrap the entire fetch-parse cycle inside the retry executor
    const executeFetch = async (): Promise<T> => {
      // --- 8a. TIMEOUTS & ABORT CONTROLLERS ---
      // Automatically manage natively explicit timeout signals while injecting user-defined signals safely
      const { controller, timeoutSignal, timeoutId } = getTimeoutController(timeout);
      const finalSignal = resolveFinalSignal(timeout, customOptions.signal, controller, timeoutSignal);

      try {
        // --- 8b. NETWORK EXECUTION ---
        // Trigger execution via browser-level fetch API mapped to standardized formatting
        const response = await fetch(finalUrl, { ...customOptions, headers, body: finalBody, signal: finalSignal });
        const expectedType = responseType || this.defaultResponseType;

        // --- 8c. RESPONSE PARSING & THROWING ---
        // Automatically evaluate network ok-state before parsing response bytes dynamically
        let data = await parseResponseBody(response, expectedType);
        handleResponseError(response, expectedType, data, config);

        // --- 8d. RESPONSE INTERCEPTOR PIPELINE ---
        // Stack any developer manipulations natively traversing across the final response bytes
        for (const interceptor of this.interceptors.response) {
          data = await interceptor(data, response);
        }

        // --- 8e. CACHE STORE (after successful fetch) ---
        // Only cache GET responses to avoid caching mutation results
        if (isCacheEnabled && method === HttpMethod.GET) {
          const cacheKey = this.cache.generateKey(method, url, query);
          this.cache.set(cacheKey, data, finalCacheTime);
        }

        return data as Extract<typeof data, T>;
      } catch (e) {
        if (e instanceof QuokkaFetchError) throw e;

        const error = e as Error;
        let code = QuokkaErrorCode.NETWORK_ERROR;
        let message = error.message;

        if (error.name === 'AbortError') {
          code = timeout ? QuokkaErrorCode.TIMEOUT : QuokkaErrorCode.ABORT;
          message = timeout ? `Request timed out after ${timeout}ms` : 'Request was manually aborted';
        }

        const qfError = new QuokkaFetchError({
          code,
          message,
          url: finalUrl,
          method: config.method || 'GET',
          cause: error,
          config
        });

        for (const interceptor of this.interceptors.error) {
          await interceptor(qfError);
        }

        throw qfError;
      } finally {

        // --- LIFECYCLE CLEANUP ---
        // Avoid hanging promises or native memory-leak garbage collection issues natively
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        timeoutId && clearTimeout(timeoutId);
      }
    };

    // --- 9. RETRY WRAPPER ---
    // Execute the fetch with automatic retries on retryable errors
    return executeWithRetry(executeFetch, finalRetryCount, finalRetryDelay);
  }

  // Public method to clear the cache
  public clearCache(): void {
    this.cache.clear();
  }
}

export function createQuokkaFetch(config?: QuokkaFetchConfig): QuokkaCallable {
  const instance = new QuokkaFetchInternal(config);

  const callable = function <T = JSONValue>(payloadArgs: QuokkaRequestPayload): Promise<T> {
    const { url, method, payload, params, query, ...rest } = payloadArgs;
    const options: FetchOptions = {
      method: method as HttpMethod,
      query: params || query,
      ...rest,
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    payload !== undefined && (options.body = payload);
    return instance.request<T>(url, options);
  };

  const finalCallable = Object.assign(callable, {
    onRequest: (handler: (config: QuokkaRequestConfig) => QuokkaRequestConfig | Promise<QuokkaRequestConfig>) => {
      instance.interceptors.request.push(handler);
      return finalCallable as never;
    },
    onResponse: (handler: (data: InterceptedResponseData, response: Response) => InterceptedResponseData | Promise<InterceptedResponseData>) => {
      instance.interceptors.response.push(handler);
      return finalCallable as never;
    },
    onError: (handler: (error: Error) => Promise<void> | void) => {
      instance.interceptors.error.push(handler);
      return finalCallable as never;
    },
    clearCache: () => {
      instance.clearCache();
    }
  });

  return finalCallable as never;
}

const qf = createQuokkaFetch();
export default qf;