import { BlazionRequestConfig } from '@blazion/core';

export const trackDownloadProgress = (
  response: Response,
  onDownloadProgress: NonNullable<BlazionRequestConfig['onDownloadProgress']>
): Response => {
  // --- 1. RESPONSE VALIDATION ---
  if (!response.body) return response;

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  let loaded = 0;

  // --- 2. STREAM CONSUMPTION ---
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
