import { BlazionErrorCode, BlazionError, BlazionRequestConfig, ProgressEventData } from '../utils';


// 1. Download Progress with native ReadableStream (Fetch API)
export const trackDownloadProgress = (
  response: Response,
  onDownloadProgress: NonNullable<BlazionRequestConfig['onDownloadProgress']>
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
  config: BlazionRequestConfig,
  finalBody: BodyInit | null | undefined
): Promise<Response> => {
  return new Promise((resolve, reject) => {

    // If not in a browser/XHR environment, gracefully reject
    if (typeof XMLHttpRequest === 'undefined') {
      return reject(new BlazionError({
        code: BlazionErrorCode.NOT_IMPLEMENTED,
        message: 'Upload progress relies on XMLHttpRequest which is not available in full execution environments.',
        url,
        method: config.method || 'GET',
        config
      }));
    }

    const xhr = new XMLHttpRequest();
    xhr.open(config.method || 'GET', url, true); // Third arg as true to enable it as async
    xhr.responseType = 'blob'; // Forces XHR to output a Native Blob for standard Fetch mapping

    // 1. Header Injection
    if (config.headers) {
      Object.entries(config.headers).forEach(([key, value]) => xhr.setRequestHeader(key, value as string));
    }

    // 2. Progress Dispatcher Factory
    const bindProgress = (event: ProgressEvent, callback?: (data: ProgressEventData) => void) => {
      if (event.lengthComputable && callback) {
        const safeTotal = Math.max(event.total, event.loaded); // Prevent edge-case inflation
        callback({
          loaded: event.loaded,
          total: safeTotal,
          progress: safeTotal ? Number((event.loaded / safeTotal).toFixed(4)) : 0
        });
      }
    };

    if (config.onUploadProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => bindProgress(e, config.onUploadProgress);
    }

    if (config.onDownloadProgress) {
      xhr.onprogress = (e) => bindProgress(e, config.onDownloadProgress);
    }

    // 3. Signal & Timeout Constraints
    config.signal?.addEventListener('abort', () => xhr.abort());
    if (config.timeout) xhr.timeout = config.timeout;

    // 4. Response Resolution Mapper
    xhr.onload = () => {
      const responseHeaders = new Headers();
      xhr.getAllResponseHeaders().trim().split(/[\r\n]+/).forEach((line) => {
        const [header, ...valParts] = line.split(': ');
        if (header) responseHeaders.append(header, valParts.join(': '));
      });

      resolve(new Response(xhr.response as Blob, {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: responseHeaders
      }));
    };

    // 5. Error Interception Factory
    const handleRejection = (code: BlazionErrorCode, message: string) => () => {
      reject(new BlazionError({ code, message, url, method: config.method || 'GET', config }));
    };

    xhr.onerror = handleRejection(BlazionErrorCode.NETWORK_ERROR, 'Network Error during XHR execution');
    xhr.onabort = handleRejection(BlazionErrorCode.ABORT, 'Request aborted manually');
    xhr.ontimeout = handleRejection(BlazionErrorCode.TIMEOUT, 'Request timed out');

    // Execute with Native formatting fallback support
    xhr.send((finalBody as XMLHttpRequestBodyInit) || null);
  });
};
