import { QuokkaErrorCode, ResponseType } from './enums';
import { JSONValue, QueryParams, RequestPayload, QuokkaRequestConfig, InterceptedResponseData, QuokkaFetchError } from './types';
import { Response_Status_Code, getBodyStrategies, getSignalStrategies } from './conditions';

// Building query params 
export const buildQueryString = (query?: QueryParams): string => {
  if (!query) return '';

  const entries = Object.entries(query);

  const ALLOWED_TYPES = new Set(['string', 'number', 'boolean', 'undefined']);
  for (const [key, val] of entries) {
    const type = typeof val;
    if (val !== null && !ALLOWED_TYPES.has(type)) {
      throw new TypeError(`[QuokkaFetch] Invalid parameter type for key "${key}". Expected string, number, boolean, null, or undefined but got "${type}".`);
    }
  }

  return new URLSearchParams(
    entries
      .filter(([_, val]) => val != null)
      .map(([k, v]) => [k, String(v)])
  ).toString();
};

// handling Default And Custom Headers
export const mergeHeaders = (defaultHeaders: HeadersInit, customHeaders?: HeadersInit): Headers => {
  const merged = new Headers(defaultHeaders);
  const custom = new Headers(customHeaders);
  custom.forEach((value, key) => merged.set(key, value));
  return merged;
};

// Parsing Response Body
export const parseResponseBody = async (response: Response, expectedType: ResponseType): Promise<InterceptedResponseData> => {
  const parsers: Record<string, (res: Response) => Promise<JSONValue | string | Blob | ArrayBuffer | FormData>> = {
    [ResponseType.JSON]: (res) => res.json(),
    [ResponseType.TEXT]: (res) => res.text(),
    [ResponseType.BLOB]: (res) => res.blob(),
    [ResponseType.ARRAY_BUFFER]: (res) => res.arrayBuffer(),
    [ResponseType.FORM_DATA]: (res) => res.formData(),
  };

  return await (parsers[expectedType] || parsers[ResponseType.JSON])(response);
};

// Error Handling Logic
export const handleResponseError = (response: Response, expectedType: ResponseType, data: InterceptedResponseData, config: QuokkaRequestConfig): void => {
  if (!response.ok) {
    const message = `[QF Error] ${response.status} ${response.statusText}`;
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => { headers[key] = value; });
    const code = Response_Status_Code[response.status] || QuokkaErrorCode.SERVER_ERROR;

    throw new QuokkaFetchError({
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

// Handling Content Type
export const resolvePayloadAndHeaders = (rawBody: RequestPayload | undefined | null, headers: Headers): BodyInit | null | undefined => {
  const bodyStrategies = getBodyStrategies(headers);
  return (rawBody !== undefined)
    ? (bodyStrategies.find(s => s.match(rawBody)) || bodyStrategies[2]).action(rawBody)
    : undefined;
};

// Controller Management
export const getTimeoutController = (timeout?: number) => {
  const controller = timeout ? new AbortController() : undefined;
  const timeoutId = timeout ? setTimeout(() => controller?.abort(), timeout) : undefined;
  return { controller, timeoutSignal: controller?.signal, timeoutId };
};

// Signal Resolution Mapping
export const resolveFinalSignal = (timeout: number | undefined, customSignal: AbortSignal | null | undefined, controller: AbortController | undefined, timeoutSignal: AbortSignal | undefined): AbortSignal | undefined | null => {
  const type = `${!!timeout}_${!!customSignal}`;
  return getSignalStrategies(customSignal, controller, timeoutSignal)[type]();
};
