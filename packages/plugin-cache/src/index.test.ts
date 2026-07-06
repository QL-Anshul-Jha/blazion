import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BlazionInternalPublic, BlazionConfig, HttpMethod } from '@blazion/core';
import { CachePlugin } from './index';

const createFakeInstance = (config: BlazionConfig = {}): BlazionInternalPublic => ({
  config,
  interceptors: { request: [], response: [], error: [] },
  installedPlugins: new Set<string>(),
});

describe('CachePlugin', () => {
  test('caches GET responses and skips the executor on a hit', async () => {
    const instance = createFakeInstance();
    CachePlugin().install(instance);

    let calls = 0;
    const executor = async () => { calls += 1; return { n: calls }; };
    const config = { url: '/x', method: HttpMethod.GET, qCache: true };

    const first = await instance.executionWrapper!(executor, config);
    const second = await instance.executionWrapper!(executor, config);

    assert.deepEqual(first, { n: 1 });
    assert.deepEqual(second, { n: 1 }); // served from cache, not a fresh call
    assert.equal(calls, 1);
  });

  test('does not cache when qCache is disabled', async () => {
    const instance = createFakeInstance();
    CachePlugin().install(instance);

    let calls = 0;
    const executor = async () => { calls += 1; return calls; };
    const config = { url: '/x', method: HttpMethod.GET };

    await instance.executionWrapper!(executor, config);
    await instance.executionWrapper!(executor, config);
    assert.equal(calls, 2);
  });

  test('does not cache non-GET methods even with qCache enabled', async () => {
    const instance = createFakeInstance();
    CachePlugin().install(instance);

    let calls = 0;
    const executor = async () => { calls += 1; return calls; };
    const config = { url: '/x', method: HttpMethod.POST, qCache: true };

    await instance.executionWrapper!(executor, config);
    await instance.executionWrapper!(executor, config);
    assert.equal(calls, 2);
  });

  test('dedupes concurrent in-flight GET requests', async () => {
    const instance = createFakeInstance();
    CachePlugin().install(instance);

    let calls = 0;
    let resolveExecutor: (v: number) => void = () => {};
    const executor = () => { calls += 1; return new Promise<number>((r) => { resolveExecutor = r; }); };
    const config = { url: '/dedupe', method: HttpMethod.GET, qCache: true };

    const p1 = instance.executionWrapper!(executor, config);
    const p2 = instance.executionWrapper!(executor, config);
    resolveExecutor(42);

    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(calls, 1);
    assert.equal(r1, 42);
    assert.equal(r2, 42);
  });

  test('clearCache() wipes cached entries via clearCacheFn', async () => {
    const instance = createFakeInstance();
    CachePlugin().install(instance);

    let calls = 0;
    const executor = async () => { calls += 1; return calls; };
    const config = { url: '/x', method: HttpMethod.GET, qCache: true };

    await instance.executionWrapper!(executor, config);
    instance.clearCacheFn!();
    await instance.executionWrapper!(executor, config);

    assert.equal(calls, 2);
  });

  test('global cache options apply when per-request qCache is not set', async () => {
    const instance = createFakeInstance();
    CachePlugin({ globalCacheEnabled: true }).install(instance);

    let calls = 0;
    const executor = async () => { calls += 1; return calls; };
    const config = { url: '/x', method: HttpMethod.GET };

    await instance.executionWrapper!(executor, config);
    await instance.executionWrapper!(executor, config);
    assert.equal(calls, 1);
  });
});
