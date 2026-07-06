// HTTP Methods
export const HttpMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
} as const;
export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

// Response formats
export const ResponseType = {
  JSON: 'json',
  TEXT: 'text',
  BLOB: 'blob',
  ARRAY_BUFFER: 'arraybuffer',
  FORM_DATA: 'formdata',
} as const;
export type ResponseType = (typeof ResponseType)[keyof typeof ResponseType];

// Error codes (RFC 9457 aligned)
export const BlazionErrorCode = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  ABORT: 'ABORT_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
  NOT_ACCEPTABLE: 'NOT_ACCEPTABLE',
  GONE: 'GONE',
  LENGTH_REQUIRED: 'LENGTH_REQUIRED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  UPGRADE_REQUIRED: 'UPGRADE_REQUIRED',
  PRECONDITION_REQUIRED: 'PRECONDITION_REQUIRED',
  HEADERS_TOO_LARGE: 'HEADERS_TOO_LARGE',
  LEGAL_BLOCKED: 'LEGAL_BLOCKED',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  NETWORK_AUTH_REQUIRED: 'NETWORK_AUTH_REQUIRED',
  BAD_GATEWAY: 'BAD_GATEWAY',
  UNKNOWN: 'UNKNOWN_ERROR',
} as const;
export type BlazionErrorCode = (typeof BlazionErrorCode)[keyof typeof BlazionErrorCode];

// Plugin identifiers
export const BlazionPluginName = {
  CACHE: 'cache',
  RETRY: 'retry',
  UPLOAD: 'upload_progress',
  DOWNLOAD: 'download_progress',
  AUTH: 'auth',
} as const;

export type BlazionPluginName = (typeof BlazionPluginName)[keyof typeof BlazionPluginName];
