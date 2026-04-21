# 🌌 Blazion

**A tiny, strictly-typed, and zero-dependency fetch wrapper.**

Blazion is built for developers who want the power of Axios with the footprint of native `fetch`. It enforces consistent API definitions, provides a fluent lifecycle API, and offers a modular plugin system for advanced features like retries and caching.

[![Size](https://img.shields.io/badge/bundle--size-~8KB-blue?style=flat-square)](https://github.com/quokkalabs/blazion)
[![TypeScript](https://img.shields.io/badge/types-Strict-blue?style=flat-square)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

---

## ✨ Features

- **⚡ Zero Dependency**: Uses native `fetch` and standard Web APIs.
- **🛡️ Strictly Typed**: Integrated TypeScript types; no `any`, no `unknown`.
- **🧩 Modular Plugins**: Pay-only-for-what-you-need (Retry, Cache, Progress).
- **🌊 Fluent API**: Clean lifecycle hooks (`onRequest`, `onResponse`, `onError`).
- **📦 Payload Auto-Detection**: Support for JSON, FormData, and Blobs out of the box.

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install @blazion/core
```

### 2. Setup Instance
```typescript
import { createBlazion } from '@blazion/core';

const api = createBlazion({
  baseURL: 'https://api.example.com/v1',
});

// Add global headers or logic
api.onRequest((config) => {
  config.headers = { ...config.headers, Authorization: 'Bearer YOUR_TOKEN' };
  return config;
});

// Capture all errors globally (logging, analytics, etc.)
api.onError((error) => {
  console.error(`Request failed: ${error.url}`, error);
});
```

### 3. Make a Request
```typescript
interface User { id: number; name: string; }

const user = await api<User>({
  url: '/users/1',
  method: 'GET'
});

console.log(user.name); // Correctly typed!
```

---

## 🛠️ Advanced Features (Plugins)

Extend Blazion with optional plugins:

```typescript
import { RetryPlugin } from '@blazion/plugin-retry';
import { CachePlugin } from '@blazion/plugin-cache';

api.use(RetryPlugin());
api.use(CachePlugin());

// Use plugin features in any request
await api({
  url: '/data',
  retry: 3,         // Retry 3 times on failure
  qCache: true,     // Enable 1-minute caching
});
```

Check out [**blazion_examples.md**](./blazion_examples.md) for more complex scenarios.

---

## 🎯 Our Philosophy

We believe in **"Consistency as a Service"**. By defining your endpoints as static objects and using a unified `api(config)` pattern, your codebase stays clean, predictable, and easy to audit.

---

&copy; 2026 Quokka Labs. Built with 💙 for the modern web.
