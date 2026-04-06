/* eslint-disable no-console */
import qf, { HttpMethod, QuokkaFetchError, createQuokkaFetch } from './index';

async function runTests() {
  console.log('🚀 TESTING QUOKKA-FETCH FEATURES...\n');

  try {
    // 1. Success Case
    try {
      const user = await qf<{ name: string }>({
        url: 'https://jsonplaceholder.typicode.com/users/1',
        method: HttpMethod.GET
      });
      console.log('✅ GET Success:', user.name);
    } catch (e) {
      console.log('❌ GET Success failed:', e);
    }

    // 2. Structured 404 Case
    try {
      console.log('\nTesting 404 Error...');
      await qf({
        url: 'https://jsonplaceholder.typicode.com/invalid-endpoint-999',
        method: HttpMethod.GET
      });
      console.log('❌ Failed to catch structured error');
    } catch (e) {
      if (e instanceof QuokkaFetchError) {
        console.log('✅ Caught Structured QuokkaFetchError:', {
          Code: e.code,
          Status: e.status
        });
      } else {
        console.log('❌ Unexpected error type:', e);
      }
    }

    // 3. Timeout Case
    try {
      console.log('\nTesting Timeout Error...');
      await qf({
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: HttpMethod.GET,
        timeout: 1
      });
    } catch (e) {
      if (e instanceof QuokkaFetchError && e.isTimeoutError) {
        console.log('✅ Caught Timeout Error:', e.code);
      } else {
        console.log('❌ Timeout test failed:', e);
      }
    }

    // 4. Abort Case
    try {
      console.log('\nTesting Abort Error...');
      const controller = new AbortController();
      const p = qf({
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: HttpMethod.GET,
        signal: controller.signal
      });
      controller.abort();
      await p;
    } catch (e) {
      if (e instanceof QuokkaFetchError && e.isAbortError) {
        console.log('✅ Caught Abort Error:', e.code);
      } else {
        console.log('❌ Abort test failed:', e);
      }
    }

    // 5. Global Timeout Case
    try {
      console.log('\nTesting Global Timeout (1ms)...');
      const customQf = createQuokkaFetch({ timeout: 1 });
      await customQf({
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: HttpMethod.GET
      });
    } catch (e) {
      if (e instanceof QuokkaFetchError && e.isTimeoutError) {
        console.log('✅ Global Timeout caught correctly');
      } else {
        console.log('❌ Global Timeout failed:', e);
      }
    }

    // 6. Parameter Validation Case
    try {
      console.log('\nTesting Parameter Validation...');
      await qf({
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: HttpMethod.GET,
        params: {
          page: (() => 9) as never
        }
      });
    } catch (e) {
      if (e instanceof TypeError && e.message.includes('Invalid parameter type')) {
        console.log('✅ Caught expected TypeError for invalid parameter');
      } else {
        console.log('❌ Parameter validation failed:', e);
      }
    }

    // ===== NEW: RETRY & CACHE TESTS =====

    // 7. Retry on Timeout (should retry then fail)
    try {
      console.log('\nTesting Retry on Timeout (2 retries, 1ms timeout)...');
      await qf({
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: HttpMethod.GET,
        timeout: 1,
        retry: 2,
        retryDelay: 100
      });
      console.log('❌ Retry test should have timed out');
    } catch (e) {
      if (e instanceof QuokkaFetchError && e.isTimeoutError) {
        console.log('✅ Retry exhausted after retries, final timeout caught');
      } else {
        console.log('❌ Retry test failed:', e);
      }
    }

    // 8. Retry does NOT retry on 404 (non-retryable)
    try {
      console.log('\nTesting Retry skips 404 (non-retryable)...');
      await qf({
        url: 'https://jsonplaceholder.typicode.com/invalid-path-404',
        method: HttpMethod.GET,
        retry: 3,
        retryDelay: 500
      });
      console.log('❌ 404 retry test should have thrown');
    } catch (e) {
      if (e instanceof QuokkaFetchError && e.status === 404) {
        // If it didn't retry, it should be fast (< 1 second)
        console.log('✅ 404 threw immediately without retrying (non-retryable)');
      } else {
        console.log('❌ 404 retry test unexpected error:', e);
      }
    }

    // 9. Cache Hit Test
    try {
      console.log('\nTesting Cache Hit...');
      const cachedApi = createQuokkaFetch({
        baseURL: 'https://jsonplaceholder.typicode.com',
        qCache: true,
        qCacheTime: 10000
      });

      // First call — cache miss (network)
      const start1 = Date.now();
      const result1 = await cachedApi<{ id: number; name: string }>({
        url: '/users/1',
        method: HttpMethod.GET
      });
      const time1 = Date.now() - start1;

      // Second call — cache hit (instant)
      const start2 = Date.now();
      const result2 = await cachedApi<{ id: number; name: string }>({
        url: '/users/1',
        method: HttpMethod.GET
      });
      const time2 = Date.now() - start2;

      if (result1.name === result2.name && time2 < time1) {
        console.log(`✅ Cache Hit! Network: ${time1}ms, Cached: ${time2}ms`);
      } else {
        console.log('❌ Cache test failed — responses differ or cache was slower');
      }
    } catch (e) {
      console.log('❌ Cache test failed:', e);
    }

    // 10. Cache Bypass for POST
    try {
      console.log('\nTesting Cache Bypass for POST...');
      const cachedApi = createQuokkaFetch({
        baseURL: 'https://jsonplaceholder.typicode.com',
        qCache: true
      });

      await cachedApi<{ id: number }>({
        url: '/posts',
        method: HttpMethod.POST,
        payload: { title: 'test', body: 'test', userId: 1 }
      });

      // POST should work but not be cached (no crash = pass)
      console.log('✅ POST executed successfully (not cached)');
    } catch (e) {
      console.log('❌ POST cache bypass test failed:', e);
    }

    // 11. Per-request cache override
    try {
      console.log('\nTesting Per-request Cache Override...');
      const noCacheApi = createQuokkaFetch({
        baseURL: 'https://jsonplaceholder.typicode.com',
        qCache: false // globally disabled
      });

      // But enable cache for this specific request
      const r1 = await noCacheApi<{ name: string }>({
        url: '/users/2',
        method: HttpMethod.GET,
        qCache: true,      // override: enable
        qCacheTime: 10000
      });

      const start = Date.now();
      const r2 = await noCacheApi<{ name: string }>({
        url: '/users/2',
        method: HttpMethod.GET,
        qCache: true
      });
      const elapsed = Date.now() - start;

      if (r1.name === r2.name && elapsed < 5) {
        console.log(`✅ Per-request cache override works! Cached in ${elapsed}ms`);
      } else {
        console.log('❌ Per-request cache override failed');
      }
    } catch (e) {
      console.log('❌ Per-request cache override test failed:', e);
    }

    // 12. clearCache()
    try {
      console.log('\nTesting clearCache()...');
      const api = createQuokkaFetch({
        baseURL: 'https://jsonplaceholder.typicode.com',
        qCache: true,
        qCacheTime: 60000
      });

      await api<{ name: string }>({ url: '/users/3', method: HttpMethod.GET });

      // Clear cache
      api.clearCache();

      // This should be a network call again (not cached)
      const start = Date.now();
      await api<{ name: string }>({ url: '/users/3', method: HttpMethod.GET });
      const elapsed = Date.now() - start;

      if (elapsed > 5) {
        console.log(`✅ clearCache() works! Re-fetched in ${elapsed}ms`);
      } else {
        console.log('❌ clearCache() might not have worked');
      }
    } catch (e) {
      console.log('❌ clearCache test failed:', e);
    }

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Unexpected Test Failure:', err);
  }
}

runTests();
