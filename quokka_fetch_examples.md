# QuokkaFetch — Complete Usage Examples

Every feature, every scenario.

---

## 1. Instance Creation ([createQuokkaFetch](file:///home/user/Work/quokka-fetch/src/index.ts#169-204))

```ts
import qf, { createQuokkaFetch, HttpMethod, ResponseType, QuokkaFetchError } from 'quokka-fetch';

// ━━━ Default instance (zero config) ━━━
qf({ url: 'https://api.example.com/users' });

// ━━━ Custom instance (real-world setup) ━━━
const api = createQuokkaFetch({
  baseURL: 'https://api.myapp.com/v1',
  headers: { Authorization: 'Bearer token123' },
  timeout: 10000,        // 10s default timeout
  responseType: ResponseType.JSON,
  retry: 2,              // retry failed requests 2 times
  retryDelay: 1000,      // start with 1s delay (exponential backoff)
  qCache: true,          // enable response caching
  qCacheTime: 300000,    // cache for 5 minutes
});
```

---

## 2. HTTP Methods

```ts
// ━━━ GET ━━━
const users = await api<User[]>({ url: '/users' });

// ━━━ POST ━━━
const newUser = await api<User>({
  url: '/users',
  method: HttpMethod.POST,
  payload: { name: 'Anshul', email: 'anshul@example.com' },
});

// ━━━ PUT (full replace) ━━━
await api({
  url: '/users/0023',
  method: HttpMethod.PUT,
  payload: { name: 'Anshul Jha', email: 'anshul@new.com', pin: '1234' },
});

// ━━━ PATCH (partial update) ━━━
await api({
  url: '/users/0023',
  method: HttpMethod.PATCH,
  payload: { pin: '5678' },
});

// ━━━ DELETE ━━━
await api({ url: '/users/0023', method: HttpMethod.DELETE });
```

---

## 3. Query Parameters

```ts
// Simple params
const page1 = await api<PaginatedResponse>({
  url: '/users',
  params: { page: 1, limit: 20 },
});
// → GET /v1/users?page=1&limit=20

// With search and filters
const results = await api<PaginatedResponse>({
  url: '/subscriptions',
  params: { search: 'Anshul', status: 'active', page: 2 },
});
// → GET /v1/subscriptions?search=Anshul&status=active&page=2

// Null/undefined values are auto-filtered out
const filtered = await api<PaginatedResponse>({
  url: '/users',
  params: { role: 'admin', deleted: null, archived: undefined },
});
// → GET /v1/users?role=admin (null & undefined stripped)
```

---

## 4. Response Types

```ts
// ━━━ JSON (default) ━━━
const data = await api<User>({ url: '/users/1' });

// ━━━ Text ━━━
const html = await api<string>({
  url: '/page',
  responseType: ResponseType.TEXT,
});

// ━━━ Blob (file download) ━━━
const pdf = await api<Blob>({
  url: '/reports/export',
  responseType: ResponseType.BLOB,
});
const downloadUrl = URL.createObjectURL(pdf);

// ━━━ ArrayBuffer (binary data) ━━━
const buffer = await api<ArrayBuffer>({
  url: '/files/image.png',
  responseType: ResponseType.ARRAY_BUFFER,
});

// ━━━ FormData ━━━
const formData = await api<FormData>({
  url: '/form-response',
  responseType: ResponseType.FORM_DATA,
});
```

---

## 5. Body Auto-Detection

QuokkaFetch automatically sets `Content-Type` based on what you pass:

```ts
// ━━━ Object/Array → auto JSON.stringify + Content-Type: application/json ━━━
await api({
  url: '/users',
  method: HttpMethod.POST,
  payload: { name: 'Anshul' },
});

// ━━━ FormData → browser handles Content-Type (multipart/form-data + boundary) ━━━
const form = new FormData();
form.append('avatar', fileInput.files[0]);
form.append('name', 'Anshul');
await api({
  url: '/upload',
  method: HttpMethod.POST,
  payload: form,
});

// ━━━ String → auto-sniffed ━━━
// Starts with { or [ → application/json
await api({ url: '/data', method: HttpMethod.POST, payload: '{"key":"value"}' });

// Starts with <html → text/html
await api({ url: '/render', method: HttpMethod.POST, payload: '<html><body>Hi</body></html>' });

// Starts with <?xml → application/xml
await api({ url: '/xml', method: HttpMethod.POST, payload: '<?xml version="1.0"?><root/>' });

// Anything else → text/plain
await api({ url: '/log', method: HttpMethod.POST, payload: 'just a plain string' });

// ━━━ Blob/ArrayBuffer/ReadableStream → passed through as-is ━━━
const blob = new Blob(['hello'], { type: 'text/plain' });
await api({ url: '/upload', method: HttpMethod.POST, payload: blob });
```

---

## 6. Timeouts & Abort

```ts
// ━━━ Timeout (auto-abort after Xms) ━━━
try {
  await api({ url: '/slow-endpoint', timeout: 3000 }); // 3s limit
} catch (err) {
  const error = err as QuokkaFetchError;
  error.isTimeoutError; // true
  error.code;           // "TIMEOUT_ERROR"
  error.message;        // "Request timed out after 3000ms"
}

// ━━━ Manual Abort ━━━
const controller = new AbortController();

// Start the request
const promise = api({ url: '/long-poll', signal: controller.signal });

// Cancel it after 2 seconds (or on button click, etc.)
setTimeout(() => controller.abort(), 2000);

try {
  await promise;
} catch (err) {
  const error = err as QuokkaFetchError;
  error.isAbortError; // true
  error.code;         // "ABORT_ERROR"
}

// ━━━ Both timeout + manual abort (whichever fires first) ━━━
const ctrl = new AbortController();
await api({
  url: '/endpoint',
  timeout: 10000,          // auto-abort at 10s
  signal: ctrl.signal,     // OR user can abort manually
});
```

---

## 7. Retry (Automatic)

```ts
// ━━━ Instance-level (all requests retry 3 times) ━━━
const api = createQuokkaFetch({
  baseURL: 'https://api.myapp.com',
  retry: 3,
  retryDelay: 1000,  // 1s → 2s → 4s (exponential backoff, max 30s)
});

// ━━━ Per-request override ━━━
await api({
  url: '/critical-endpoint',
  retry: 5,            // this request retries 5 times
  retryDelay: 500,     // starts at 500ms
});

// ━━━ Disable retry for a specific request ━━━
await api({
  url: '/users',
  retry: 0,   // no retries, even if instance has retry: 3
});
```

**What's retryable?**
| Scenario | Retries? |
|---|---|
| Timeout | ✅ Yes |
| Network error on GET | ✅ Yes |
| 5xx server errors | ✅ Yes |
| 400 Bad Request | ❌ No (your fault) |
| 401 Unauthorized | ❌ No |
| 404 Not Found | ❌ No |
| 422 Validation Error | ❌ No |

---

## 8. Caching

```ts
// ━━━ Enable at instance level ━━━
const api = createQuokkaFetch({
  baseURL: 'https://api.myapp.com',
  qCache: true,
  qCacheTime: 60000,  // 1 minute TTL
});

// First call → hits network, caches the response
const users1 = await api<User[]>({ url: '/users' });

// Second call within 1 minute → returns cached data instantly (no network)
const users2 = await api<User[]>({ url: '/users' });

// ━━━ Per-request override ━━━
// Disable cache for this specific request
await api({ url: '/users', qCache: false });

// Different TTL for this request
await api({ url: '/config', qCache: true, qCacheTime: 600000 }); // 10 min

// ━━━ Bust the cache manually (e.g., after a mutation) ━━━
await api({ url: '/users', method: HttpMethod.POST, payload: { name: 'New User' } });
api.clearCache();  // wipe all cached data so next GET is fresh
```

> [!NOTE]
> Only **GET** requests are cached. POST/PUT/PATCH/DELETE are never cached.

---

## 9. Interceptors

### 9a. [onRequest](file:///home/user/Work/quokka-fetch/src/index.ts#185-189) — Modify config before every request

```ts
// Auth token injection
api.onRequest(async (config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers = new Headers(config.headers);
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// Request logging
api.onRequest((config) => {
  console.log(`→ ${config.method ?? 'GET'} ${config.url}`);
  return config;
});

// Multi-tenant header
api.onRequest((config) => {
  config.headers = new Headers(config.headers);
  config.headers.set('X-Tenant-ID', 'tenant-abc');
  return config;
});
```

### 9b. [onResponse](file:///home/user/Work/quokka-fetch/src/index.ts#189-193) — Transform response data

```ts
// Unwrap API envelope: { data: ..., meta: ... } → just data
api.onResponse((data, response) => {
  const envelope = data as { data: unknown };
  if (envelope && typeof envelope === 'object' && 'data' in envelope) {
    return envelope.data as JSONValue;
  }
  return data;
});

// Response logging
api.onResponse((data, response) => {
  console.log(`← ${response.status} ${response.url}`);
  return data;  // must always return data
});
```

### 9c. [onError](file:///home/user/Work/quokka-fetch/src/index.ts#193-197) — React to errors globally

```ts
// Auto-redirect on 401
api.onError((error) => {
  if (error instanceof QuokkaFetchError && error.status === 401) {
    localStorage.removeItem('accessToken');
    window.location.href = '/login';
  }
});

// Global error logging
api.onError((error) => {
  if (error instanceof QuokkaFetchError) {
    console.error(`[API Error] ${error.code} @ ${error.url}`, error.details);
  }
});

// Send to monitoring (e.g., Sentry)
api.onError(async (error) => {
  if (error instanceof QuokkaFetchError && error.status && error.status >= 500) {
    await sendToSentry(error);
  }
});
```

### Chaining interceptors (fluent API)

```ts
const api = createQuokkaFetch({ baseURL: 'https://api.myapp.com' })
  .onRequest((config) => { /* auth */ return config; })
  .onResponse((data) => { /* unwrap */ return data; })
  .onError((err) => { /* log */ });
```

---

## 10. Error Handling

```ts
try {
  const user = await api<User>({ url: '/users/9999' });
} catch (err) {
  const error = err as QuokkaFetchError;

  // ━━━ Error identity ━━━
  error.name;          // "QuokkaFetchError"
  error.code;          // "NOT_FOUND"
  error.message;       // "[QF Error] 404 Not Found"

  // ━━━ HTTP details ━━━
  error.status;        // 404
  error.statusText;    // "Not Found"
  error.url;           // "https://api.myapp.com/v1/users/9999"
  error.method;        // "GET"
  error.headers;       // { "content-type": "application/json", ... }

  // ━━━ Response body (parsed) ━━━
  error.details;       // { message: "User not found" } — whatever BE sent
  error.raw;           // same as details (raw parsed response)

  // ━━━ Metadata ━━━
  error.timestamp;     // "2026-04-06T05:36:00.000Z"
  error.requestId;     // "A3F2B1" (random, useful for support tickets)
  error.retryable;     // false

  // ━━━ Boolean flags ━━━
  error.isNetworkError; // true if network failure (no internet)
  error.isTimeoutError; // true if timeout
  error.isAbortError;   // true if manually aborted

  // ━━━ Conditional handling ━━━
  if (error.status === 401) {
    redirectToLogin();
  } else if (error.status === 422) {
    showValidationErrors(error.details);
  } else if (error.isNetworkError) {
    showToast('No internet connection');
  } else if (error.isTimeoutError) {
    showToast('Server took too long');
  }
}
```

---

## 11. Real-World Setup (Putting It All Together)

```ts
// ━━━━ src/lib/api.ts ━━━━
import { createQuokkaFetch, QuokkaFetchError, HttpMethod } from 'quokka-fetch';

// Types
interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  page: number;
}
interface User {
  id: string;
  username: string;
  email: string;
}

// Instance
const api = createQuokkaFetch({
  baseURL: 'https://api.myapp.com/v1',
  headers: { Accept: 'application/json' },
  timeout: 10000,
  retry: 2,
  retryDelay: 1000,
  qCache: true,
  qCacheTime: 60000,
});

// Interceptors (set once, applies to ALL requests)
api.onRequest(async (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = new Headers(config.headers);
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.onError((error) => {
  if (error instanceof QuokkaFetchError && error.status === 401) {
    window.location.href = '/login';
  }
});

export default api;

// ━━━━ src/pages/Users.tsx ━━━━
import api from '@/lib/api';

// GET paginated users (cached)
const { data: users, totalCount } = await api<PaginatedResponse<User>>({
  url: '/users',
  params: { page: 1, limit: 20, search: 'Anshul' },
});

// POST create user (not cached, auto Content-Type)
const newUser = await api<User>({
  url: '/users',
  method: HttpMethod.POST,
  payload: { username: 'Anshul', email: 'anshul@example.com' },
});
api.clearCache(); // bust cache after mutation

// File upload with longer timeout
const form = new FormData();
form.append('avatar', file);
await api({
  url: `/users/${newUser.id}/avatar`,
  method: HttpMethod.POST,
  payload: form,
  timeout: 30000,
  retry: 0,       // don't retry uploads
});
```
