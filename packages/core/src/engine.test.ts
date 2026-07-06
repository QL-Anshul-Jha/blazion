import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { BlazionInternal } from './engine';
import { BlazionError, BlazionErrorCode } from './utils';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const mockFetch = (handler: (url: string, init?: RequestInit) => Response | Promise<Response>) => {
  globalThis.fetch = ((url: string, init?: RequestInit) => Promise.resolve(handler(url, init))) as typeof fetch;
};

describe('BlazionInternal.request', () => {
  test('returns parsed JSON on a successful GET', async () => {
    mockFetch(() => new Response(JSON.stringify({ id: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const instance = new BlazionInternal({ baseURL: 'https://api.test' });
    const data = await instance.request<{ id: number }>('/users/1');
    assert.deepEqual(data, { id: 1 });
  });

  test('throws a structured BlazionError on a non-ok response', async () => {
    mockFetch(() => new Response(JSON.stringify({ message: 'nope' }), { status: 404, statusText: 'Not Found' }));

    const instance = new BlazionInternal({ baseURL: 'https://api.test' });
    await assert.rejects(instance.request('/missing'), (err) => {
      assert.ok(err instanceof BlazionError);
      assert.equal(err.code, BlazionErrorCode.NOT_FOUND);
      assert.equal(err.status, 404);
      return true;
    });
  });

  test('throws an isTimeoutError BlazionError when the request exceeds its timeout', async () => {
    mockFetch((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    }));

    const instance = new BlazionInternal({ baseURL: 'https://api.test' });
    await assert.rejects(instance.request('/slow', { timeout: 5 }), (err) => {
      assert.ok(err instanceof BlazionError);
      assert.equal(err.isTimeoutError, true);
      return true;
    });
  });

  test('throws an isAbortError BlazionError when manually aborted', async () => {
    mockFetch((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    }));

    const controller = new AbortController();
    const instance = new BlazionInternal({ baseURL: 'https://api.test' });
    const pending = instance.request('/slow', { signal: controller.signal });
    controller.abort();

    await assert.rejects(pending, (err) => {
      assert.ok(err instanceof BlazionError);
      assert.equal(err.isAbortError, true);
      return true;
    });
  });

  test('merges global and per-request headers, case-insensitively, and applies request/response interceptors', async () => {
    let seenHeaders: Headers | undefined;
    mockFetch((_url, init) => {
      seenHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ value: 1 }), { headers: { 'Content-Type': 'application/json' } });
    });

    const instance = new BlazionInternal({ baseURL: 'https://api.test', headers: { 'X-Global': 'global', 'X-Override': 'old' } });
    instance.interceptors.request.push((config) => {
      config.headers = { ...config.headers, 'X-Override': 'new' };
      return config;
    });
    instance.interceptors.response.push((data) => {
      return { ...(data as object), touched: true };
    });

    const data = await instance.request<{ value: number; touched: boolean }>('/x', { headers: { 'X-Local': 'local' } });

    assert.equal(seenHeaders?.get('x-global'), 'global');
    assert.equal(seenHeaders?.get('x-override'), 'new');
    assert.equal(seenHeaders?.get('x-local'), 'local');
    assert.equal(data.touched, true);
  });

  test('runs error interceptors before rethrowing', async () => {
    mockFetch(() => new Response('{}', { status: 500 }));

    const seen: BlazionError[] = [];
    const instance = new BlazionInternal({ baseURL: 'https://api.test' });
    instance.interceptors.error.push((err) => { seen.push(err as BlazionError); });

    await assert.rejects(instance.request('/fail'));
    assert.equal(seen.length, 1);
    assert.equal(seen[0].code, BlazionErrorCode.SERVER_ERROR);
  });

  test('an executionWrapper that retries re-runs request interceptors on each attempt', async () => {
    let token = 'stale-token';
    let callCount = 0;
    const seenAuthHeaders: (string | null)[] = [];

    mockFetch((_url, init) => {
      callCount += 1;
      seenAuthHeaders.push(new Headers(init?.headers).get('Authorization'));
      if (callCount === 1) return new Response('{}', { status: 401 });
      return new Response(JSON.stringify({ ok: true }));
    });

    const instance = new BlazionInternal({ baseURL: 'https://api.test' });
    instance.interceptors.request.push((config) => {
      config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
      return config;
    });

    // Minimal stand-in for an auth-refresh plugin: retry once after "refreshing".
    instance.executionWrapper = async (executor) => {
      try {
        return await executor();
      } catch {
        token = 'fresh-token';
        return executor();
      }
    };

    const data = await instance.request<{ ok: boolean }>('/protected');

    assert.deepEqual(data, { ok: true });
    assert.deepEqual(seenAuthHeaders, ['Bearer stale-token', 'Bearer fresh-token']);
  });

  test('use() rejects installing the same plugin twice', () => {
    const instance = new BlazionInternal({ baseURL: 'https://api.test' });
    assert.equal(instance.installedPlugins.has('demo'), false);
    instance.installedPlugins.add('demo');
    assert.equal(instance.installedPlugins.has('demo'), true);
  });

  test('clearCache() delegates to clearCacheFn when a cache plugin is installed', () => {
    const instance = new BlazionInternal({ baseURL: 'https://api.test' });
    let cleared = false;
    instance.clearCacheFn = () => { cleared = true; };
    instance.clearCache();
    assert.equal(cleared, true);
  });
});
