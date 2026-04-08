import { BlazionError } from '../utils';

const MAX_RETRY_DELAY = 30000;

// Execute a function with exponential backoff retries
export const executeWithRetry = async <T>(
  fn: () => Promise<T>,
  retryCount: number,
  retryDelay: number
): Promise<T> => {
  let lastError: BlazionError | Error | null = null;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e as BlazionError | Error;

      // If the error is a BlazionError, only retry if it's retryable
      if (lastError instanceof BlazionError && !lastError.retryable) {
        throw lastError;
      }

      // If we've exhausted all retries, throw
      if (attempt === retryCount) throw lastError;

      // Exponential backoff: delay * 2^attempt, capped at MAX_RETRY_DELAY
      const delay = Math.min(retryDelay * Math.pow(2, attempt), MAX_RETRY_DELAY);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
};
