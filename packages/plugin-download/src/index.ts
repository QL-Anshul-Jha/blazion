import { BlazionPlugin, BlazionPluginName, BlazionInternalPublic, BlazionRequestConfig } from '@blazion/core';
import { trackDownloadProgress } from './helpers';
import './types'; // Ensure module augmentation is loaded

export const DownloadPlugin = (): BlazionPlugin => {
  // --- 1. PLUGIN DEFINITION ---
  return {
    name: BlazionPluginName.DOWNLOAD,
    install(instance: BlazionInternalPublic) {
      if (typeof window === 'undefined') return;

      // --- 2. ENGINE ADAPTER ---
      const currentAdapter = instance.engineAdapter;

      instance.engineAdapter = async (url: string, config: BlazionRequestConfig, body: BodyInit | null | undefined, defaultFetch: typeof fetch) => {
        let response: Response;
        if (currentAdapter) {
          response = await currentAdapter(url, config, body, defaultFetch);
        } else {
          response = await defaultFetch(url, { ...config, body } as RequestInit);
        }

        if (config.onDownloadProgress) {
          response = trackDownloadProgress(response, config.onDownloadProgress);
        }

        return response;
      };
    }
  };
};
