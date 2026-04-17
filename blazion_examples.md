# 💡 Blazion Examples

Welcome to the Blazion examples guide. This document demonstrates the most common patterns and plugin usages to help you get the most out of the library.

---

## 1. Authentication & Global Interceptors
The best way to handle auth is via global `onRequest` hooks.

```typescript
import { createBlazion } from '@blazion/core';

const api = createBlazion({ baseURL: 'https://api.myapp.com' });

api.onRequest((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`
    };
  }
  return config;
});

// All subsequent calls will now include the Bearer token!
await api({ url: '/profile', method: 'GET' });
```

---

## 2. Reliable Requests (Retry Plugin)
Never worry about transient network errors again.

```typescript
import { createBlazion } from '@blazion/core';
import { RetryPlugin } from '@blazion/plugin-retry';

const api = createBlazion();
api.use(RetryPlugin());

// This request will automatically retry up to 3 times on 5xx or network errors
await api({
  url: 'https://flaky-api.com/status',
  method: 'GET',
  retry: 3,
  retryDelay: 1000 // 1 second between retries
});
```

---

## 3. High Performance (Cache Plugin)
Optimize your app by caching frequent GET requests.

```typescript
import { createBlazion } from '@blazion/core';
import { CachePlugin } from '@blazion/plugin-cache';

const api = createBlazion();
api.use(CachePlugin());

// The first call hits the network, the second returns from memory
await api({
  url: '/settings',
  method: 'GET',
  qCache: true,
  qCacheTime: 300000 // Cache for 5 minutes
});
```

---

## 4. Interactive Progress (Upload & Download)
Provide real-time feedback for large file transfers.

```typescript
import { createBlazion } from '@blazion/core';
import { UploadPlugin } from '@blazion/plugin-upload';
import { DownloadPlugin } from '@blazion/plugin-download';

const api = createBlazion();
api.use(UploadPlugin());
api.use(DownloadPlugin());

// Upload with progress
await api({
  url: '/upload',
  method: 'POST',
  payload: myLargeFile,
  onUploadProgress: (progress) => {
    console.log(`Uploaded: ${progress}%`);
  }
});

// Download with progress
await api({
  url: '/video.mp4',
  method: 'GET',
  onDownloadProgress: (progress) => {
    console.log(`Downloaded: ${progress}%`);
  }
});
```

---

## 5. Strict Type Safety
Explicitly define your response types for a better developer experience.

```typescript
interface Post {
  id: number;
  title: string;
  body: string;
}

// 'posts' will be an array of Post objects
const posts = await api<Post[]>({
  url: 'https://jsonplaceholder.typicode.com/posts',
  method: 'GET'
});

console.log(posts[0].title); // Full IDE completion!
```

---

## 6. Elegant Error Handling
Catch and inspect errors with the structured `BlazionError`.

```typescript
import { BlazionError } from '@blazion/core';

try {
  await api({ url: '/protected-resource', method: 'GET' });
} catch (error) {
  if (error instanceof BlazionError) {
    console.log(`Status Code: ${error.status}`);
    console.log(`Internal Code: ${error.code}`); // e.g., 'ERR_UNAUTHORIZED'
    
    if (error.isTimeoutError) {
      console.log('The request took too long!');
    }
  }
}
```
