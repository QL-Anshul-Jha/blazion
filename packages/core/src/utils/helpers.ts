import { BlazionErrorCode, ResponseType } from './enums';
import { JSONValue, QueryParams, RequestPayload, BlazionRequestConfig, InterceptedResponseData, BlazionError } from './types';
import { Response_Status_Code, getBodyStrategies, getSignalStrategies } from './conditions';

// Build query string
export const buildQueryString = (query?: QueryParams): string => {
  if (!query) return '';

  const entries = Object.entries(query);

  const ALLOWED_TYPES = new Set(['string', 'number', 'boolean', 'undefined']);

  for (const [key, val] of entries) {
    const type = typeof val;
    if (val !== null && !ALLOWED_TYPES.has(type)) {
      throw new TypeError(`[Blazion] Invalid parameter type for key "${key}". Expected string, number, boolean, null, or undefined but got "${type}".`);
    }
  }

  return new URLSearchParams(
    entries
      .filter(([_, val]) => val != null)
      .map(([k, v]) => [k, String(v)])
  ).toString();
};

// Flatten any HeadersInit shape into a case-normalized record, last value wins.
// Deliberately does this with plain assignment rather than `new Headers(init)`:
// the Headers constructor treats same-name-different-casing keys as distinct
// and *appends* (comma-joins) them instead of letting the later one override.
export const toHeaderRecord = (init?: HeadersInit): Record<string, string> => {
  const record: Record<string, string> = {};
  if (!init) return record;

  const entries: Iterable<[string, string]> = init instanceof Headers || Array.isArray(init)
    ? init
    : Object.entries(init);

  for (const [key, value] of entries) {
    record[key.toLowerCase()] = value;
  }
  return record;
};

// Merge default + custom headers
export const mergeHeaders = (defaultHeaders: HeadersInit, customHeaders?: HeadersInit): Record<string, string> => {
  return { ...toHeaderRecord(defaultHeaders), ...toHeaderRecord(customHeaders) };
};

// Parse response body
export const parseResponseBody = async (response: Response, expectedType: ResponseType): Promise<InterceptedResponseData> => {
  const parsers: Record<string, (res: Response) => Promise<InterceptedResponseData>> = {
    [ResponseType.JSON]: (res) => res.json(),
    [ResponseType.TEXT]: (res) => res.text(),
    [ResponseType.BLOB]: (res) => res.blob(),
    [ResponseType.ARRAY_BUFFER]: (res) => res.arrayBuffer(),
    [ResponseType.FORM_DATA]: (res) => res.formData(),
  };

  return await (parsers[expectedType] || parsers[ResponseType.JSON])(response);
};

// Handle non-OK responses
export const handleResponseError = (response: Response, expectedType: ResponseType, data: InterceptedResponseData, config: BlazionRequestConfig): void => {
  if (!response.ok) {
    const message = `[QF Error] ${response.status} ${response.statusText}`;
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => { headers[key] = value; });
    const code = Response_Status_Code[response.status] || BlazionErrorCode.SERVER_ERROR;

    throw new BlazionError({
      code,
      message,
      status: response.status,
      statusText: response.statusText,
      data: data as JSONValue,
      headers,
      config,
      url: response.url,
      method: config.method || 'GET',
      raw: data as JSONValue
    });
  }
};

// Resolve body + content-type
export const resolvePayloadAndHeaders = (rawBody: RequestPayload | undefined | null, headers: Headers): BodyInit | null | undefined => {
  const bodyStrategies = getBodyStrategies(headers);
  return (rawBody !== undefined)
    ? (bodyStrategies.find(s => s.match(rawBody)) || bodyStrategies[2]).action(rawBody)
    : undefined;
};

// Create timeout controller
export const getTimeoutController = (timeout?: number) => {
  const controller = timeout ? new AbortController() : undefined;
  // A distinct `TimeoutError` reason lets the caller tell "timed out" apart from
  // a user-initiated abort — both otherwise surface as an identical AbortError.
  const timeoutId = timeout
    ? setTimeout(() => controller?.abort(new DOMException('The operation timed out.', 'TimeoutError')), timeout)
    : undefined;
  return { controller, timeoutSignal: controller?.signal, timeoutId };
};

// Resolve final abort signal
export const resolveFinalSignal = (timeout: number | undefined, customSignal: AbortSignal | null | undefined, controller: AbortController | undefined, timeoutSignal: AbortSignal | undefined): AbortSignal | undefined | null => {
  const type = `${!!timeout}_${!!customSignal}`;
  return getSignalStrategies(customSignal, controller, timeoutSignal)[type]();
};


