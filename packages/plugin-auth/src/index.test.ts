import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BlazionInternalPublic, BlazionError, BlazionErrorCode } from '@blazion/core';
import { AuthPlugin } from './index';

const createFakeInstance = (): BlazionInternalPublic => ({
  config: {},
  interceptors: { request: [], response: [], error: [] },
  installedPlugins: new Set<string>(),
});

const unauthorized = () => new BlazionError({
  code: BlazionErrorCode.UNAUTHORIZED, status: 401, message: 'nope', url: '/x', method: 'GET', config: { url: '/x', method: 'GET' }
});

describe('AuthPlugin', () => {
  test('does not call refreshToken when the request succeeds', async () => {
    const instance = createFakeInstance();
    let refreshCalls = 0;
    AuthPlugin({ refreshToken: () => { refreshCalls += 1; } }).install(instance);

    const result = await instance.executionWrapper!(async () => 'ok', { url: '/x', method: 'GET' });

    assert.equal(result, 'ok');
    assert.equal(refreshCalls, 0);
  });

  test('refreshes once and retries once on a 401, returning the retry result', async () => {
    const instance = createFakeInstance();
    let refreshCalls = 0;
    let executorCalls = 0;
    AuthPlugin({ refreshToken: () => { refreshCalls += 1; } }).install(instance);

    const executor = async () => {
      executorCalls += 1;
      if (executorCalls === 1) throw unauthorized();
      return 'recovered';
    };

    const result = await instance.executionWrapper!(executor, { url: '/x', method: 'GET' });

    assert.equal(result, 'recovered');
    assert.equal(refreshCalls, 1);
    assert.equal(executorCalls, 2);
  });

  test('propagates the error if the retry after refresh also fails, without looping', async () => {
    const instance = createFakeInstance();
    let refreshCalls = 0;
    let executorCalls = 0;
    AuthPlugin({ refreshToken: () => { refreshCalls += 1; } }).install(instance);

    const executor = async () => { executorCalls += 1; throw unauthorized(); };

    await assert.rejects(
      instance.executionWrapper!(executor, { url: '/x', method: 'GET' }),
      (err) => err instanceof BlazionError && err.code === BlazionErrorCode.UNAUTHORIZED
    );
    assert.equal(refreshCalls, 1);
    assert.equal(executorCalls, 2); // original attempt + exactly one retry
  });

  test('concurrent 401s share a single in-flight refreshToken call', async () => {
    const instance = createFakeInstance();
    let refreshCalls = 0;
    let resolveRefresh: () => void = () => {};
    AuthPlugin({
      refreshToken: () => new Promise<void>((r) => { refreshCalls += 1; resolveRefresh = r; })
    }).install(instance);

    const makeExecutor = () => {
      let calls = 0;
      return async () => { calls += 1; if (calls === 1) throw unauthorized(); return 'ok'; };
    };

    const p1 = instance.executionWrapper!(makeExecutor(), { url: '/a', method: 'GET' });
    const p2 = instance.executionWrapper!(makeExecutor(), { url: '/b', method: 'GET' });

    // Let both requests fail and start waiting on the refresh before resolving it.
    await new Promise((r) => setTimeout(r, 10));
    resolveRefresh();

    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1, 'ok');
    assert.equal(r2, 'ok');
    assert.equal(refreshCalls, 1);
  });

  test('skipAuthRefresh bypasses the refresh flow entirely', async () => {
    const instance = createFakeInstance();
    let refreshCalls = 0;
    AuthPlugin({ refreshToken: () => { refreshCalls += 1; } }).install(instance);

    await assert.rejects(
      instance.executionWrapper!(async () => { throw unauthorized(); }, { url: '/x', method: 'GET', skipAuthRefresh: true })
    );
    assert.equal(refreshCalls, 0);
  });

  test('a custom shouldRefresh predicate controls what triggers a refresh', async () => {
    const instance = createFakeInstance();
    let refreshCalls = 0;
    AuthPlugin({
      refreshToken: () => { refreshCalls += 1; },
      shouldRefresh: (err) => err.status === 403
    }).install(instance);

    // 401 no longer triggers a refresh under this custom predicate.
    await assert.rejects(instance.executionWrapper!(async () => { throw unauthorized(); }, { url: '/x', method: 'GET' }));
    assert.equal(refreshCalls, 0);
  });

  test('non-BlazionError failures propagate without triggering a refresh', async () => {
    const instance = createFakeInstance();
    let refreshCalls = 0;
    AuthPlugin({ refreshToken: () => { refreshCalls += 1; } }).install(instance);

    await assert.rejects(
      instance.executionWrapper!(async () => { throw new Error('network down'); }, { url: '/x', method: 'GET' }),
      /network down/
    );
    assert.equal(refreshCalls, 0);
  });
});
