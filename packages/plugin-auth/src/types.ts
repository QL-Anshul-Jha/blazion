import { BlazionError } from '@blazion/core';

declare module '@blazion/core' {
  interface BlazionPluginIndividualRequestConfig {
    /** Skip the auth-refresh flow for this one request (e.g. the login/refresh endpoint itself). */
    skipAuthRefresh?: boolean;
  }
}

export interface AuthPluginOptions {
  /**
   * Called once per expired-token event, even if multiple requests fail with 401
   * concurrently. Should resolve once a new token has been obtained and stored
   * wherever the app's own `onRequest` interceptor reads it from.
   */
  refreshToken: () => Promise<void> | void;
  /** Decide whether a failure should trigger a refresh. Defaults to checking for a 401. */
  shouldRefresh?: (error: BlazionError) => boolean;
}
