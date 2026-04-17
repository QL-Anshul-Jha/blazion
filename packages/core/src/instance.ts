import {
  HttpMethod, JSONValue, BlazionConfig, BlazionRequestConfig, InterceptedResponseData, BlazionCallable, BlazionRequestPayload, FetchOptions, BlazionPlugin
} from './utils';
import { BlazionInternal } from './engine';

export function createBlazion(config: BlazionConfig): BlazionCallable {
  const instance = new BlazionInternal(config);

  const callable = function <T = JSONValue>(payloadArgs: BlazionRequestPayload): Promise<T> {
    const { url, method, payload, params, query, ...rest } = payloadArgs;
    const options: FetchOptions = {
      method: method as HttpMethod,
      query: params || query,
      ...rest,
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    payload !== undefined && (options.body = payload);
    return instance.request<T>(url, options);
  };

  const finalCallable = Object.assign(callable, {
    onRequest: (handler: (config: BlazionRequestConfig) => BlazionRequestConfig | Promise<BlazionRequestConfig>) => {
      instance.interceptors.request.push(handler);
      return finalCallable;
    },
    onResponse: (handler: (data: InterceptedResponseData, response: Response) => InterceptedResponseData | Promise<InterceptedResponseData>) => {
      instance.interceptors.response.push(handler);
      return finalCallable;
    },
    onError: (handler: (error: Error) => Promise<void> | void) => {
      instance.interceptors.error.push(handler);
      return finalCallable;
    },
    clearCache: () => {
      instance.clearCache();
    },
    use: (plugin: BlazionPlugin) => {
      if (instance.installedPlugins.has(plugin.name)) {
        throw new Error(`[Blazion] Plugin "${plugin.name}" is already registered. Each plugin can only be installed once per instance.`);
      }
      plugin.install(instance);
      instance.installedPlugins.add(plugin.name);
      return finalCallable;
    },
    create: (config: BlazionConfig) => createBlazion(config)
  }) as BlazionCallable;

  return finalCallable;
}

