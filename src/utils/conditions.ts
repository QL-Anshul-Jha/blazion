import { QuokkaErrorCode } from './enums';
import { RequestPayload } from './types';

// RFC 9457 & Custom Error Mapping
export const Response_Status_Code: Record<number, QuokkaErrorCode> = {
  400: QuokkaErrorCode.BAD_REQUEST,
  401: QuokkaErrorCode.UNAUTHORIZED,
  403: QuokkaErrorCode.FORBIDDEN,
  404: QuokkaErrorCode.NOT_FOUND,
  405: QuokkaErrorCode.METHOD_NOT_ALLOWED,
  408: QuokkaErrorCode.TIMEOUT,
  409: QuokkaErrorCode.CONFLICT,
  422: QuokkaErrorCode.VALIDATION_ERROR,
  429: QuokkaErrorCode.TOO_MANY_REQUESTS,
  500: QuokkaErrorCode.SERVER_ERROR,
  502: QuokkaErrorCode.BAD_GATEWAY,
  503: QuokkaErrorCode.SERVICE_UNAVAILABLE,
  504: QuokkaErrorCode.GATEWAY_TIMEOUT,
  406: QuokkaErrorCode.NOT_ACCEPTABLE,
  410: QuokkaErrorCode.GONE,
  411: QuokkaErrorCode.LENGTH_REQUIRED,
  413: QuokkaErrorCode.PAYLOAD_TOO_LARGE,
  415: QuokkaErrorCode.UNSUPPORTED_MEDIA_TYPE,
  426: QuokkaErrorCode.UPGRADE_REQUIRED,
  428: QuokkaErrorCode.PRECONDITION_REQUIRED,
  431: QuokkaErrorCode.HEADERS_TOO_LARGE,
  451: QuokkaErrorCode.LEGAL_BLOCKED,
  501: QuokkaErrorCode.NOT_IMPLEMENTED,
  511: QuokkaErrorCode.NETWORK_AUTH_REQUIRED,
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
