import { BlazionPlugin, BlazionPluginName, BlazionInternalPublic, BlazionRequestConfig, InterceptedResponseData } from '@blazion/core';
import { RetryOptions } from './types';
import { executeWithRetry } from './helpers';

export const RetryPlugin = (options?: RetryOptions): BlazionPlugin => {
  // --- 1. PLUGIN DEFINITION ---
  return {
    name: BlazionPluginName.RETRY,
    install(instance: BlazionInternalPublic) {
      const globalRetryCount = options?.globalRetry ?? instance.config.retry ?? 0;
      const globalRetryDelay = options?.globalRetryDelay ?? instance.config.retryDelay ?? 1000;

      // --- 2. EXECUTION WRAPPER ---
      const currentWrapper = instance.executionWrapper;

      instance.executionWrapper = async <T = InterceptedResponseData>(executor: () => Promise<T>, config: BlazionRequestConfig): Promise<T> => {
        const maxRetries = config.retry ?? globalRetryCount;
        const delay = config.retryDelay ?? globalRetryDelay;

        const downstreamExecutor = async (): Promise<T> => {
          return currentWrapper ? (currentWrapper(executor, config) as Promise<T>) : executor();
        };

        return executeWithRetry<T>(downstreamExecutor, maxRetries, delay);
      };
    }
  };
};
