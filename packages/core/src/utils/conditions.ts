import { BlazionErrorCode } from './enums';
import { RequestPayload } from './types';

// HTTP status → error code mapping
export const Response_Status_Code: Record<number, BlazionErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  406: 'NOT_ACCEPTABLE',
  408: 'TIMEOUT_ERROR',
  409: 'CONFLICT',
  410: 'GONE',
  411: 'LENGTH_REQUIRED',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'VALIDATION_ERROR',
  426: 'UPGRADE_REQUIRED',
  428: 'PRECONDITION_REQUIRED',
  429: 'TOO_MANY_REQUESTS',
  431: 'HEADERS_TOO_LARGE',
  451: 'LEGAL_BLOCKED',
  500: 'SERVER_ERROR',
  501: 'NOT_IMPLEMENTED',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
  511: 'NETWORK_AUTH_REQUIRED',
};

// Body serialization strategies
export const getBodyStrategies = (headers: Headers) => [
  // Binary pass-through
  {
    match: (b: RequestPayload) => b instanceof FormData || b instanceof Blob || b instanceof ArrayBuffer || b instanceof ReadableStream || b instanceof URLSearchParams,
    action: (b: RequestPayload) => b as BodyInit
  },
  // URL-encoded formulation
  {
    match: (b: RequestPayload) => typeof b === 'object' && b !== null && headers.get('Content-Type')?.includes('application/x-www-form-urlencoded'),
    action: (b: RequestPayload) => new URLSearchParams(b as Record<string, string>).toString()
  },
  // Objects & arrays → JSON
  {
    match: (b: RequestPayload) => (typeof b === 'object' && b !== null) || Array.isArray(b) || typeof b === 'number' || typeof b === 'boolean' || b === null,
    action: (b: RequestPayload) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      !headers.has('Content-Type') && headers.set('Content-Type', 'application/json');
      return JSON.stringify(b);
    }
  },
  // String with content-type sniffing
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

// Signal selection (timeout + manual abort)
export const getSignalStrategies = (customSignal: AbortSignal | null | undefined, controller: AbortController | undefined, timeoutSignal: AbortSignal | undefined): Record<string, () => AbortSignal | undefined | null> => {
  return {
    'true_true': () => {
      const envSupportsAny = typeof AbortSignal !== 'undefined' && 'any' in AbortSignal;
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      (!envSupportsAny) && customSignal?.addEventListener('abort', () => controller?.abort(customSignal.reason));

      return envSupportsAny
        ? AbortSignal.any([customSignal as AbortSignal, timeoutSignal as AbortSignal])
        : timeoutSignal;
    },
    'true_false': () => timeoutSignal,
    'false_true': () => customSignal,
    'false_false': () => undefined
  };
};
