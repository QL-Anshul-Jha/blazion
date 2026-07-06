import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createBlazion } from '@blazion/core';
import { AuthPlugin } from './index';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe('AuthPlugin end-to-end through createBlazion', () => {
  test('refreshes an expired token and retries the real request with the fresh one', async () => {
    let token = 'stale-token';
    const seenAuthHeaders: (string | null)[] = [];

    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get('Authorization');
      seenAuthHeaders.push(auth);
      if (auth === 'Bearer stale-token') return new Response('{}', { status: 401 });
      return new Response(JSON.stringify({ profile: 'me' }), { headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    const api = createBlazion({ baseURL: 'https://api.test' });
    api.onRequest((config) => {
      config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
      return config;
    });
    api.use(AuthPlugin({
      refreshToken: () => { token = 'fresh-token'; }
    }));

    const data = await api<{ profile: string }>({ url: '/profile', method: 'GET' });

    assert.deepEqual(data, { profile: 'me' });
    assert.deepEqual(seenAuthHeaders, ['Bearer stale-token', 'Bearer fresh-token']);
  });
});
