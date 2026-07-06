import { BlazionPlugin, BlazionPluginName, BlazionInternalPublic, BlazionRequestConfig, InterceptedResponseData, BlazionError, BlazionErrorCode } from '@blazion/core';
import { AuthPluginOptions } from './types';
import { createSingleFlightRefresh } from './helpers';

export const AuthPlugin = (options: AuthPluginOptions): BlazionPlugin => {
  return {
    name: BlazionPluginName.AUTH,
    install(instance: BlazionInternalPublic) {
      const shouldRefresh = options.shouldRefresh ?? ((error: BlazionError) => error.code === BlazionErrorCode.UNAUTHORIZED);
      const runRefresh = createSingleFlightRefresh(options.refreshToken);

      const currentWrapper = instance.executionWrapper;

      instance.executionWrapper = async <T = InterceptedResponseData>(executor: () => Promise<T>, config: BlazionRequestConfig): Promise<T> => {
        const downstreamExecutor = (): Promise<T> => (currentWrapper ? (currentWrapper(executor, config) as Promise<T>) : executor());

        if (config.skipAuthRefresh) return downstreamExecutor();

        try {
          return await downstreamExecutor();
        } catch (error) {
          if (!(error instanceof BlazionError) || !shouldRefresh(error)) throw error;

          // One refresh, one retry. If the retry also fails, that error propagates as-is.
          await runRefresh();
          return downstreamExecutor();
        }
      };
    }
  };
};

export type { AuthPluginOptions } from './types';
