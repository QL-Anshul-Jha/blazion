import { InterceptedResponseData, QueryParams, RequestPayload, QuokkaRequestConfig, QuokkaFetchError, JSONValue } from './types';
import { ResponseType, QuokkaErrorCode } from './enums';
import { parsers } from './conditions';

// Building query params 
export const buildQueryString = (query?: QueryParams): string => {
  const qs = query 
    ? new URLSearchParams(
        Object.entries(query)
          .filter(([_, val]) => val != null)
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : '';
  return qs;
};

export const mergeHeaders = (defaultHeaders: HeadersInit, customHeaders?: HeadersInit): Headers => {
  const headers = new Headers(defaultHeaders);
  new Headers(customHeaders || {}).forEach((value, key) => headers.set(key, value));
  return headers;
};

export const parseResponseBody = async (response: Response, expectedType: ResponseType): Promise<InterceptedResponseData> => {
  return await (parsers[expectedType] || parsers[ResponseType.JSON])(response);
};

export const handleResponseError = (response: Response, expectedType: ResponseType, data: InterceptedResponseData, config: QuokkaRequestConfig): void => {
  if (!response.ok) {
    const message = `[QF Error] ${response.status} ${response.statusText}`;
    
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => { headers[key] = value; });

    let code: QuokkaErrorCode = QuokkaErrorCode.SERVER_ERROR;
    if (response.status === 401) code = QuokkaErrorCode.UNAUTHORIZED;
    if (response.status === 403) code = QuokkaErrorCode.FORBIDDEN;
    if (response.status === 404) code = QuokkaErrorCode.NOT_FOUND;
    if (response.status === 422) code = QuokkaErrorCode.VALIDATION_ERROR;

    throw new QuokkaFetchError({
      code,
      message,
      url: response.url,
      method: config.method || 'GET',
      status: response.status,
      statusText: response.statusText,
      data: data as JSONValue,
      headers,
      config,
      raw: data as JSONValue
    });
  }
};

//---------------------------------------------------------------------------------------------------------------------------------------//
//----------------------------------------------------MAJOR FUNCTIONS--------------------------------------------------------------------//
//---------------------------------------------------------------------------------------------------------------------------------------//

// Payload & Content-Type Resolution
import { getBodyStrategies, getSignalStrategies } from './conditions';

export const resolvePayloadAndHeaders = (rawBody: RequestPayload | undefined | null, headers: Headers): BodyInit | null | undefined => {
    const bodyStrategies = getBodyStrategies(headers);
    return (rawBody !== undefined && rawBody !== null)
      ? (bodyStrategies.find(s => s.match(rawBody)) || bodyStrategies[2]).action(rawBody)
      : undefined;
};

// Controller Management
export const createAbortController = (timeout?: number) => {
    const controller = timeout ? new AbortController() : undefined;
    const timeoutId = timeout ? setTimeout(() => controller?.abort(), timeout) : undefined;
    return { controller, timeoutSignal: controller?.signal, timeoutId };
};

// Signal Resolution Mapping
export const resolveFinalSignal = (timeout: number | undefined, customSignal: AbortSignal | null | undefined, controller: AbortController | undefined, timeoutSignal: AbortSignal | undefined) => {
    const type = `${!!timeout}_${!!customSignal}`;
    return getSignalStrategies(customSignal, controller, timeoutSignal)[type]();
};
