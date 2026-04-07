/* eslint-disable no-console */
import { createQuokkaFetch, HttpMethod, QuokkaFetchError } from './index';

async function demo() {
  console.log('🚀 QUOKKA-FETCH DEMO\n');

  // ========================================
  // SETUP 1: Global retry + cache via config
  // ========================================
  const apiWithFeatures = createQuokkaFetch({
    baseURL: 'https://jsonplaceholder.typicode.com',
    retry: 2,
    retryDelay: 500,
    qCache: true,
    qCacheTime: 30000,
  });

  // ========================================
  // SETUP 2: Clean API (no retry, no cache)
  // ========================================
  const api = createQuokkaFetch({
    baseURL: 'https://jsonplaceholder.typicode.com',
  });

  // ----- CACHE DEMO (global config) -----
  console.log('--- CACHE (via config) ---');
  const t1 = Date.now();
  await apiWithFeatures({ url: '/users/1' });
  console.log(`  1st call (network): ${Date.now() - t1}ms`);

  const t2 = Date.now();
  await apiWithFeatures({ url: '/users/1' });
  console.log(`  2nd call (cached):  ${Date.now() - t2}ms ⚡\n`);

  // ----- CACHE DEMO (per-request) -----
  console.log('--- CACHE (per-request on clean API) ---');
  const t3 = Date.now();
  await api({ url: '/users/2', qCache: true, qCacheTime: 10000 });
  console.log(`  1st call (network): ${Date.now() - t3}ms`);

  const t4 = Date.now();
  await api({ url: '/users/2', qCache: true });
  console.log(`  2nd call (cached):  ${Date.now() - t4}ms ⚡\n`);

  // ----- RETRY DEMO (global config) -----
  console.log('--- RETRY (via config) ---');
  try {
    await apiWithFeatures({ url: '/posts', timeout: 1 });
  } catch (e) {
    if (e instanceof QuokkaFetchError) {
      console.log(`  Error: ${e.code} — retried automatically before failing\n`);
    }
  }

  // ----- RETRY DEMO (per-request) -----
  console.log('--- RETRY (per-request on clean API) ---');
  try {
    await api({ url: '/posts', timeout: 1, retry: 1, retryDelay: 200 });
  } catch (e) {
    if (e instanceof QuokkaFetchError) {
      console.log(`  Error: ${e.code} — retried 1 time before failing\n`);
    }
  }

  // ----- ABORT CONTROLLER DEMO -----
  console.log('--- ABORT CONTROLLER ---');
  const controller = new AbortController();

  // Abort after 50ms
  setTimeout(() => controller.abort(), 50);

  try {
    await api({ url: '/posts', method: HttpMethod.GET, signal: controller.signal });
  } catch (e) {
    if (e instanceof QuokkaFetchError && e.isAbortError) {
      console.log(`  ✅ Request aborted: ${e.code}\n`);
    }
  }

  // ----- PROGRESS DEMO -----
  console.log('--- UPLOAD & DOWNLOAD PROGRESS ---');
  try {
    await api({
      url: '/posts',
      method: HttpMethod.POST,
      payload: { title: 'large payload simulation', data: 'A'.repeat(500000) },
      onUploadProgress: (e) => {
        console.log(`  Upload Progress: ${(e.progress * 100).toFixed(0)}% (${e.loaded}/${e.total} bytes)`);
      },
      onDownloadProgress: (e) => {
        console.log(`  Download Progress: ${(e.progress * 100).toFixed(0)}% (${e.loaded}/${e.total} bytes)`);
      }
    });
    console.log('  ✅ Upload & Download Progress complete\n');
  } catch (e) {
    if (e instanceof Error) {
       console.log('❌ Progress test failed:', e);
    }
  }

  console.log('🎉 DEMO COMPLETE!');
}

demo().catch(console.error);
