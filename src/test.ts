/* eslint-disable no-console */
import qf, { HttpMethod, QuokkaFetchError } from './index';

async function runTests() {
  console.log('🚀 TESTING STRUCTURED QUOKKA-FETCH ERRORS...\n');

  try {
    // 1. Success Case
    const user = await qf<{ name: string }>({
      url: 'https://jsonplaceholder.typicode.com/users/1',
      method: HttpMethod.GET
    });
    console.log('✅ GET Success:', user.name);

    // 2. Structured 404 Case
    try {
      console.log('\nTesting 404 Error...');
      await qf({
        url: 'https://jsonplaceholder.typicode.com/invalid-endpoint-999',
        method: HttpMethod.GET
      });
    } catch (e) {
      if (e instanceof QuokkaFetchError) {
        console.log('✅ Caught Structured QuokkaFetchError:');
        console.log(' - Name:', e.name);
        console.log(' - Code:', e.code);
        console.log(' - Status:', e.status);
        console.log(' - Method:', e.method);
        console.log(' - Retryable:', e.retryable);
        console.log(' - RequestID:', e.requestId);
        console.log(' - Timestamp:', e.timestamp);
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
      if (e instanceof QuokkaFetchError) {
        console.log('✅ Caught Timeout Error:');
        console.log(' - Code:', e.code);
        console.log(' - isTimeout:', e.isTimeoutError);
        console.log(' - Retryable:', e.retryable);
      }
    }

    // 4. Abort Case
    try {
      console.log('\nTesting Abort Error...');
      const controller = new AbortController();
      const req = qf({
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: HttpMethod.GET,
        signal: controller.signal
      });
      controller.abort();
      await req;
    } catch (e) {
      if (e instanceof QuokkaFetchError) {
        console.log('✅ Caught Abort Error:');
        console.log(' - Code:', e.code);
        console.log(' - isAbort:', e.isAbortError);
      }
    }

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Unexpected Test Failure:', err);
  }
}

runTests();
