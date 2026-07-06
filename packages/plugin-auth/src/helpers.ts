// Ensures concurrent 401s trigger exactly one refreshToken() call.
export const createSingleFlightRefresh = (refreshToken: () => Promise<void> | void): (() => Promise<void>) => {
  let inFlight: Promise<void> | null = null;

  return (): Promise<void> => {
    if (!inFlight) {
      inFlight = Promise.resolve(refreshToken()).finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
};
