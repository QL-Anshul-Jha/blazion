import { RequestPayload, JSONValue, InterceptedResponseData } from './types';
import { ResponseType } from './enums';

export const getBodyStrategies = (headers: Headers) => [
  {
    match: (b: RequestPayload) => typeof FormData !== 'undefined' && b instanceof FormData ||
                                  typeof Blob !== 'undefined' && b instanceof Blob ||
                                  typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams ||
                                  typeof ArrayBuffer !== 'undefined' && (b instanceof ArrayBuffer || ArrayBuffer.isView(b)),
    action: (b: RequestPayload) => {
      headers.delete('Content-Type');
      return b as BodyInit;
    }
  },
  {
    match: (b: RequestPayload) => typeof b === 'string',
    action: (b: RequestPayload) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      !headers.has('Content-Type') && headers.set('Content-Type', 'text/plain');
      return b as string;
    }
  },
  {
    match: () => true, // default JSON strategy
    action: (b: RequestPayload) => {
      headers.set('Content-Type', 'application/json');
      return JSON.stringify(b);
    }
  }
];

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

export const parsers: Record<string, (r: Response) => Promise<InterceptedResponseData>> = {
  [ResponseType.BLOB]: (r) => r.blob(),
  [ResponseType.ARRAY_BUFFER]: (r) => r.arrayBuffer(),
  [ResponseType.FORM_DATA]: (r) => r.formData(),
  [ResponseType.TEXT]: (r) => r.text(),
  [ResponseType.JSON]: async (r) => {
    const contentType = r.headers.get('content-type');
    return (contentType && contentType.includes('application/json')) 
      ? (await r.json() as JSONValue) 
      : r.text();
  }
};

export const errorFormats: Record<string, (data: InterceptedResponseData) => string> = {
  'string': (data) => data as string,
  'json': (data) => JSON.stringify(data),
  'other': () => `[Binary / Alternative Data Format]`
};
