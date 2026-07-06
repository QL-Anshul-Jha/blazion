import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BlazionError, BlazionErrorCode } from '@blazion/core';
import { executeWithRetry } from './helpers';

const makeError = (code: BlazionErrorCode, status?: number): BlazionError => new BlazionError({
  code, message: 'boom', url: '/x', method: 'GET', status, config: { url: '/x', method: 'GET' }
});

describe('executeWithRetry', () => {
  test('returns the result immediately on first success without retrying', async () => {
    let calls = 0;
    const result = await executeWithRetry(async () => { calls += 1; return 'ok'; }, 3, 1, 'fixed');
    assert.equal(result, 'ok');
    assert.equal(calls, 1);
  });

  test('retries a retryable error up to retryCount times, then throws', async () => {
    let calls = 0;
    await assert.rejects(
      executeWithRetry(async () => { calls += 1; throw makeError(BlazionErrorCode.SERVER_ERROR, 500); }, 2, 1, 'fixed'),
      (err) => err instanceof BlazionError && err.code === BlazionErrorCode.SERVER_ERROR
    );
    assert.equal(calls, 3); // 1 initial attempt + 2 retries
  });

  test('succeeds once the underlying call recovers within the retry budget', async () => {
    let calls = 0;
    const result = await executeWithRetry(async () => {
      calls += 1;
      if (calls < 3) throw makeError(BlazionErrorCode.SERVER_ERROR, 500);
      return 'recovered';
    }, 5, 1, 'fixed');
    assert.equal(result, 'recovered');
    assert.equal(calls, 3);
  });

  test('does not retry a non-retryable error (e.g. 400)', async () => {
    let calls = 0;
    await assert.rejects(
      executeWithRetry(async () => { calls += 1; throw makeError(BlazionErrorCode.BAD_REQUEST, 400); }, 3, 1, 'fixed'),
      (err) => err instanceof BlazionError && err.code === BlazionErrorCode.BAD_REQUEST
    );
    assert.equal(calls, 1);
  });

  test('retries raw (non-BlazionError) failures too, since they represent unclassified network errors', async () => {
    let calls = 0;
    await assert.rejects(
      executeWithRetry(async () => { calls += 1; throw new Error('plain failure'); }, 3, 1, 'fixed'),
      /plain failure/
    );
    assert.equal(calls, 4); // 1 initial attempt + 3 retries
  });

  test('exponential backoff grows delay between attempts', async () => {
    const delays: number[] = [];
    let last = Date.now();
    let calls = 0;

    await assert.rejects(executeWithRetry(async () => {
      const now = Date.now();
      if (calls > 0) delays.push(now - last);
      last = now;
      calls += 1;
      throw makeError(BlazionErrorCode.SERVER_ERROR, 500);
    }, 2, 10, 'exponential'));

    // attempt delays should be ~10ms then ~20ms
    assert.ok(delays[0] >= 8, `expected first delay >= 8ms, got ${delays[0]}`);
    assert.ok(delays[1] >= delays[0], `expected second delay (${delays[1]}) >= first (${delays[0]})`);
  });

  test('an aborted signal rejects immediately and stops retrying', async () => {
    const controller = new AbortController();
    let calls = 0;

    const promise = executeWithRetry(async () => {
      calls += 1;
      throw makeError(BlazionErrorCode.SERVER_ERROR, 500);
    }, 5, 50, 'fixed', controller.signal);

    // Abort during the sleep before the second attempt.
    setTimeout(() => controller.abort(), 5);

    await assert.rejects(promise);
    assert.equal(calls, 1);
  });
});
