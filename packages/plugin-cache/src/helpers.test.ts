import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BlazionCache } from './helpers';

describe('BlazionCache', () => {
  test('generateKey is stable regardless of query key insertion order', () => {
    const cache = new BlazionCache();
    const a = cache.generateKey('GET', '/x', { b: 2, a: 1 });
    const b = cache.generateKey('GET', '/x', { a: 1, b: 2 });
    assert.equal(a, b);
  });

  test('generateKey differs by method, url, or query', () => {
    const cache = new BlazionCache();
    const base = cache.generateKey('GET', '/x', { a: 1 });
    assert.notEqual(base, cache.generateKey('POST', '/x', { a: 1 }));
    assert.notEqual(base, cache.generateKey('GET', '/y', { a: 1 }));
    assert.notEqual(base, cache.generateKey('GET', '/x', { a: 2 }));
  });

  test('set/get round-trips a value within its ttl', () => {
    const cache = new BlazionCache();
    cache.set('k', { hello: 'world' }, 1000);
    assert.deepEqual(cache.get('k'), { hello: 'world' });
    assert.equal(cache.size, 1);
  });

  test('get returns undefined and evicts an expired entry', async () => {
    const cache = new BlazionCache();
    cache.set('k', 'value', 5);
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(cache.get('k'), undefined);
    assert.equal(cache.size, 0);
  });

  test('get returns undefined for a key that was never set', () => {
    const cache = new BlazionCache();
    assert.equal(cache.get('missing'), undefined);
  });

  test('tracks and clears in-flight promises', async () => {
    const cache = new BlazionCache();
    const promise = Promise.resolve('x');
    cache.setInFlight('k', promise);
    assert.equal(cache.getInFlight('k'), promise);
    cache.deleteInFlight('k');
    assert.equal(cache.getInFlight('k'), undefined);
    await promise;
  });

  test('clear() wipes all cached entries', () => {
    const cache = new BlazionCache();
    cache.set('a', 1, 1000);
    cache.set('b', 2, 1000);
    cache.clear();
    assert.equal(cache.size, 0);
  });
});
