import { BlazionRequestConfig, BlazionPlugin, BlazionPluginName, BlazionInternalPublic } from '@blazion/core';
import { executeXhrWithUploadProgress } from './helpers';
import './types'; // Ensure module augmentation is loaded

export const UploadPlugin = (): BlazionPlugin => {
  // --- 1. PLUGIN DEFINITION ---
  return {
    name: BlazionPluginName.UPLOAD,
    install(instance: BlazionInternalPublic) {
      if (typeof window === 'undefined') return;

      // --- 2. ENGINE ADAPTER ---
      const currentAdapter = instance.engineAdapter;

      instance.engineAdapter = async (url: string, config: BlazionRequestConfig, body: BodyInit | null | undefined, defaultFetch: typeof fetch) => {
        if (config.onUploadProgress) {
          return await executeXhrWithUploadProgress(url, config, body);
        }

        if (currentAdapter) return await currentAdapter(url, config, body, defaultFetch);
        return await defaultFetch(url, { ...config, body } as RequestInit);
      };
    }
  };
};
