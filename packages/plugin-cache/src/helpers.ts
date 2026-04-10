import { CacheEntry, InterceptedResponseData } from '@blazion/core';
import './types';

// In-memory cache with TTL
export class BlazionCache {
  // --- 1. STORAGE ---
  private entries = new Map<string, CacheEntry>();

  // --- 2. KEY GENERATION ---
  generateKey(method: string, url: string, query?: Record<string, string | number | boolean | null | undefined>): string {
    const sortedQuery = query
      ? Object.keys(query).sort().map(k => `${k}=${query[k]}`).join('&')
      : '';
    return `${method}:${url}${sortedQuery ? `?${sortedQuery}` : ''}`;
  }

  // --- 3. DATA ACCESS ---
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

  // --- 4. STORAGE OPS ---
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
