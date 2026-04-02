import { HttpMethod, ResponseType, QuokkaErrorCode } from './utils/enums';
import { FetchOptions, JSONValue, QuokkaFetchConfig, QuokkaInterceptors, QuokkaRequestConfig, InterceptedResponseData, QuokkaCallable, QuokkaRequestPayload, QuokkaFetchError } from './utils/types';
import { buildQueryString, mergeHeaders, parseResponseBody, handleResponseError, resolvePayloadAndHeaders, createAbortController, resolveFinalSignal } from './utils/helpers';

export * from './utils/types';
export * from './utils/enums';

class QuokkaFetchInternal {
  private baseURL: string;
  private defaultHeaders: HeadersInit;
  private defaultResponseType: ResponseType;

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
  }

  public async request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    
    // --- 1. CONFIGURATION SETUP ---
    // Merge the base URL with the requested endpoint and default options
    let config: QuokkaRequestConfig = { url: this.baseURL + endpoint, ...options };

    // --- 2. REQUEST INTERCEPTOR PIPELINE ---
    // Pass the config through sequentially stacked developer-defined Hooks
    for (const interceptor of this.interceptors.request) {
      config = await interceptor(config);
    }

    const { url, query, timeout, responseType, body: rawBody, ...customOptions } = config;
    
    // --- 3. QUERY PARAMETERS ---
    // Format JSON object dictionaries gracefully into URL search param notation
    const qs = buildQueryString(query);
    const finalUrl = qs ? `${url}?${qs}` : url;

    // --- 4. HEADERS CONSTRUCTION ---
    // Securely combine custom explicit headers alongside library defaults
    const headers = mergeHeaders(this.defaultHeaders, customOptions.headers);

    // --- 5. PAYLOADS & CONTENT-TYPE ---
    // Filter the payload across Native definitions to dynamically resolve Content-Type tracking
    const finalBody = resolvePayloadAndHeaders(rawBody, headers);

    // --- 6. TIMEOUTS & ABORT CONTROLLERS ---
    // Automatically manage natively explicit timeout signals while injecting user-defined signals safely
    const { controller, timeoutSignal, timeoutId } = createAbortController(timeout);
    const finalSignal = resolveFinalSignal(timeout, customOptions.signal, controller, timeoutSignal);

    try {
      
      // --- 7. NETWORK EXECUTION ---
      // Trigger execution via browser-level fetch API mapped to standardized formatting
      const response = await fetch(finalUrl, { ...customOptions, headers, body: finalBody, signal: finalSignal });
      const expectedType = responseType || this.defaultResponseType;
      
      // --- 8. RESPONSE PARSING & THROWING ---
      // Automatically evaluate network ok-state before parsing response bytes dynamically
      let data = await parseResponseBody(response, expectedType);
      handleResponseError(response, expectedType, data, config);

      // --- 9. RESPONSE INTERCEPTOR PIPELINE ---
      // Stack any developer manipulations natively traversing across the final response bytes
      for (const interceptor of this.interceptors.response) {
        data = await interceptor(data, response);
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
      
      // --- 12. LIFECYCLE CLEANUP ---
      // Avoid hanging promises or native memory-leak garbage collection issues natively
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      timeoutId && clearTimeout(timeoutId);
    }
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
    }
  });

  return finalCallable as never;
}

const qf = createQuokkaFetch();
export default qf;
