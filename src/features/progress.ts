import { QuokkaRequestConfig, QuokkaFetchError } from '../utils/types';
import { QuokkaErrorCode } from '../utils/enums';

// 1. Download Progress with native ReadableStream (Fetch API)
export const trackDownloadProgress = (
  response: Response,
  onDownloadProgress: NonNullable<QuokkaRequestConfig['onDownloadProgress']>
): Response => {
  if (!response.body) return response;

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let loaded = 0;

  const reader = response.body.getReader();
  const stream = new ReadableStream({
    async start(controller) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          break;
        }
        loaded += value.byteLength;
        onDownloadProgress({
          loaded,
          total,
          progress: total ? Number((loaded / total).toFixed(4)) : 0
        });
        controller.enqueue(value);
      }
    }
  });

  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
};

// 2. Upload Progress parsing Native XHR representation to mimic native fetch
export const executeXhrWithUploadProgress = (
  url: string,
  config: QuokkaRequestConfig,
  finalBody: BodyInit | null | undefined
): Promise<Response> => {
  return new Promise((resolve, reject) => {
    // If not in a browser/XHR environment, gracefully reject
    if (typeof XMLHttpRequest === 'undefined') {
      return reject(new QuokkaFetchError({
        code: QuokkaErrorCode.NOT_IMPLEMENTED,
        message: 'Upload progress relies on XMLHttpRequest which is not available in this environment.',
        url,
        method: config.method || 'GET',
        config
      }));
    }

    const xhr = new XMLHttpRequest();
    xhr.open(config.method || 'GET', url, true);
    
    // We intentionally map the XHR response strictly to fetch Blob pattern. 
    // This allows `new Response(blob)` to naturally ingest it for our downstream JSON/text parse
    xhr.responseType = 'blob';

    // Transfer headers cleanly
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        xhr.setRequestHeader(key, value as string);
      }
    }

    if (config.onUploadProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          config.onUploadProgress!({
            loaded: event.loaded,
            total: event.total,
            progress: Number((event.loaded / event.total).toFixed(4))
          });
        }
      };
    }

    if (config.onDownloadProgress) {
      xhr.onprogress = (event) => {
        if (event.lengthComputable) {
          config.onDownloadProgress!({
            loaded: event.loaded,
            total: event.total,
            progress: Number((event.loaded / event.total).toFixed(4))
          });
        }
      };
    }

    // Bind abort controllers Native Signal to XHR instance
    if (config.signal) {
      config.signal.addEventListener('abort', () => {
        xhr.abort();
      });
    }

    xhr.onload = () => {
      // Mock the native `fetch` headers 1:1
      const responseHeaders = new Headers();
      xhr.getAllResponseHeaders().trim().split(/[\r\n]+/).forEach((line) => {
        const parts = line.split(': ');
        const header = parts.shift();
        const value = parts.join(': ');
        if (header) responseHeaders.append(header, value);
      });

      // Pass the fully native Blob into a genuine Response constructor
      const response = new Response(xhr.response as Blob, {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: responseHeaders
      });

      resolve(response);
    };

    xhr.onerror = () => {
      reject(new QuokkaFetchError({
        code: QuokkaErrorCode.NETWORK_ERROR,
        message: 'Network Error during XHR execution',
        url,
        method: config.method || 'GET',
        config
      }));
    };

    xhr.onabort = () => {
      reject(new QuokkaFetchError({
        code: QuokkaErrorCode.ABORT,
        message: 'Request aborted manually',
        url,
        method: config.method || 'GET',
        config
      }));
    };

    xhr.ontimeout = () => {
      reject(new QuokkaFetchError({
        code: QuokkaErrorCode.TIMEOUT,
        message: 'Request timed out',
        url,
        method: config.method || 'GET',
        config
      }));
    };
    
    // Wire native timeout bounds to XHR directly if requested 
    if (config.timeout) {
      xhr.timeout = config.timeout;
    }

    // Support FormData and standard strings out of the box dynamically mapping to Native XHR body semantics
    // NOTE: Native `BodyInit` does not cover all XHR capabilities natively but aligns strongly enough 
    xhr.send((finalBody as XMLHttpRequestBodyInit) || null);
  });
};
