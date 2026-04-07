import { BlazionErrorCode } from './enums';
import { RequestPayload } from './types';

// RFC 9457 & Custom Error Mapping
export const Response_Status_Code: Record<number, BlazionErrorCode> = {
  400: BlazionErrorCode.BAD_REQUEST,
  401: BlazionErrorCode.UNAUTHORIZED,
  403: BlazionErrorCode.FORBIDDEN,
  404: BlazionErrorCode.NOT_FOUND,
  405: BlazionErrorCode.METHOD_NOT_ALLOWED,
  408: BlazionErrorCode.TIMEOUT,
  409: BlazionErrorCode.CONFLICT,
  422: BlazionErrorCode.VALIDATION_ERROR,
  429: BlazionErrorCode.TOO_MANY_REQUESTS,
  500: BlazionErrorCode.SERVER_ERROR,
  502: BlazionErrorCode.BAD_GATEWAY,
  503: BlazionErrorCode.SERVICE_UNAVAILABLE,
  504: BlazionErrorCode.GATEWAY_TIMEOUT,
  406: BlazionErrorCode.NOT_ACCEPTABLE,
  410: BlazionErrorCode.GONE,
  411: BlazionErrorCode.LENGTH_REQUIRED,
  413: BlazionErrorCode.PAYLOAD_TOO_LARGE,
  415: BlazionErrorCode.UNSUPPORTED_MEDIA_TYPE,
  426: BlazionErrorCode.UPGRADE_REQUIRED,
  428: BlazionErrorCode.PRECONDITION_REQUIRED,
  431: BlazionErrorCode.HEADERS_TOO_LARGE,
  451: BlazionErrorCode.LEGAL_BLOCKED,
  501: BlazionErrorCode.NOT_IMPLEMENTED,
  511: BlazionErrorCode.NETWORK_AUTH_REQUIRED,
};

export const getBodyStrategies = (headers: Headers) => [
  // 1. Binary Types (Pass-through)
  {
    match: (b: RequestPayload) => b instanceof FormData || b instanceof Blob || b instanceof ArrayBuffer || b instanceof ReadableStream || b instanceof URLSearchParams,
    action: (b: RequestPayload) => b as BodyInit
  },

  // 2. Objects & Arrays (Auto-JSON)
  {
    match: (b: RequestPayload) => (typeof b === 'object' && b !== null) || Array.isArray(b) || typeof b === 'number' || typeof b === 'boolean' || b === null,
    action: (b: RequestPayload) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      !headers.has('Content-Type') && headers.set('Content-Type', 'application/json');
      return JSON.stringify(b);
    }
  },

  // 3. Strings with Content-Type Sniffing
  {
    match: (b: RequestPayload) => typeof b === 'string',
    action: (b: RequestPayload) => {
      const s = (b as string).trim();

      if (!headers.has('Content-Type')) {
        const contentType = [
          { check: s.startsWith('{') || s.startsWith('['), value: 'application/json' },
          { check: s.startsWith('<html') || s.toLowerCase().startsWith('<!doctype'), value: 'text/html' },
          { check: s.startsWith('<?xml'), value: 'application/xml' }
        ].find(st => st.check)?.value || 'text/plain';

        headers.set('Content-Type', contentType);
      }
      return b as string;
    }
  }
];

// Signal Selection Mapping
export const getSignalStrategies = (customSignal: AbortSignal | null | undefined, controller: AbortController | undefined, timeoutSignal: AbortSignal | undefined): Record<string, () => AbortSignal | undefined | null> => {
  return {
    'true_true': () => {
      const envSupportsAny = typeof AbortSignal !== 'undefined' && 'any' in AbortSignal;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      (!envSupportsAny) && customSignal?.addEventListener('abort', () => controller?.abort());

      return envSupportsAny
        ? AbortSignal.any([customSignal as AbortSignal, timeoutSignal as AbortSignal])
        : timeoutSignal;
    },
    'true_false': () => timeoutSignal,
    'false_true': () => customSignal,
    'false_false': () => undefined
  };
};
