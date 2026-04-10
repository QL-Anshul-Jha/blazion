import { HttpMethod, InterceptedResponseData, BlazionPlugin, BlazionPluginName, BlazionInternalPublic, BlazionRequestConfig } from '@blazion/core';
import { CacheOptions } from './types';
import { BlazionCache } from './helpers';

export const CachePlugin = (options?: CacheOptions): BlazionPlugin => {
  // --- 1. PLUGIN DEFINITION ---
  return {
    name: BlazionPluginName.CACHE,
    install(instance: BlazionInternalPublic) {
      const cache = new BlazionCache();

      const globalCacheEnabled = options?.globalCacheEnabled ?? instance.config.qCache ?? false;
      const globalCacheTime = options?.globalCacheTime ?? instance.config.qCacheTime ?? 300000;

      // --- 2. CACHE INITIALIZATION ---
      instance.clearCacheFn = () => cache.clear();

      // --- 3. EXECUTION WRAPPER ---
      const currentWrapper = instance.executionWrapper;

      instance.executionWrapper = async <T = InterceptedResponseData>(executor: () => Promise<T>, config: BlazionRequestConfig): Promise<T> => {
        const isCacheEnabled = config.qCache ?? globalCacheEnabled;
        const cacheTime = config.qCacheTime ?? globalCacheTime;
        const method = config.method || HttpMethod.GET;

        let cacheKey = '';
        if (isCacheEnabled && method === HttpMethod.GET) {
          cacheKey = cache.generateKey(method, config.url, config.query);
          const cachedData = cache.get(cacheKey);
          if (cachedData !== undefined) return cachedData as T;
        }

        // Execute downstream
        const data = currentWrapper ? await (currentWrapper(executor, config) as Promise<T>) : await executor();

        if (isCacheEnabled && method === HttpMethod.GET) {
          cache.set(cacheKey, data as InterceptedResponseData, cacheTime);
        }
        return data;
      };
    }
  };
};
