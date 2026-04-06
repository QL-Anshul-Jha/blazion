import { InterceptedResponseData, CacheEntry } from './types';

// In-memory cache with TTL-based expiry
export class QuokkaCache {
  private entries = new Map<string, CacheEntry>();

  // Generate a deterministic cache key from request params
  generateKey(method: string, url: string, query?: Record<string, string | number | boolean | null | undefined>): string {
    const sortedQuery = query
      ? Object.keys(query).sort().map(k => `${k}=${query[k]}`).join('&')
      : '';
    return `${method}:${url}${sortedQuery ? `?${sortedQuery}` : ''}`;
  }

  // Get cached data (returns undefined if expired or missing)
  get(key: string): InterceptedResponseData | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.data;
  }

  // Store response data with a TTL
  set(key: string, data: InterceptedResponseData, ttl: number): void {
    this.entries.set(key, { data, timestamp: Date.now(), ttl });
  }

  // Wipe all cache entries
  clear(): void {
    this.entries.clear();
  }

  // Current number of entries (useful for debugging)
  get size(): number {
    return this.entries.size;
  }
}
