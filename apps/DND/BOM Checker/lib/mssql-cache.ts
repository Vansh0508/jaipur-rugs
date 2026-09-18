/**
 * Server-side Query Cache Store for MS SQL
 * Caches heavy queries against [dbo].[NAV-004- Item wise BOM Details_FG-HN]
 * to prevent repeated table scans, connection pool exhaustion, and query latency.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

class MssqlCacheStore {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxEntries: number;
  private defaultTtlMs: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxEntries = 500, defaultTtlMs = 10 * 60 * 1000) {
    // Default 10 minutes TTL, max 500 entries
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Get an item from the cache. Returns null if expired or missing.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data as T;
  }

  /**
   * Put an item into the cache with optional custom TTL in milliseconds.
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs !== undefined ? ttlMs : this.defaultTtlMs;
    const now = Date.now();

    // Evict expired entries if size is exceeding limit
    if (this.cache.size >= this.maxEntries) {
      this.evict();
    }

    this.cache.set(key, {
      data,
      expiresAt: now + ttl,
      createdAt: now,
    });
  }

  /**
   * Check if a valid (non-expired) key exists.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Invalidate a specific key or all keys matching an optional prefix.
   */
  invalidate(prefix?: string): void {
    if (!prefix) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict expired or oldest entries when size limit is reached.
   */
  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }

    // If still too large, delete oldest 20% of entries
    if (this.cache.size >= this.maxEntries) {
      const entriesToDelete = Math.ceil(this.maxEntries * 0.2);
      let count = 0;
      for (const key of this.cache.keys()) {
        if (count++ >= entriesToDelete) break;
        this.cache.delete(key);
      }
    }
  }

  /**
   * Retrieve cache operational metrics
   */
  getStats(): { size: number; hits: number; misses: number; hitRate: string } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? `${Math.round((this.hits / total) * 100)}%` : "0%";
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }
}

// Global singleton to preserve cache across HMR in development
const globalForCache = globalThis as unknown as {
  mssqlCacheInstance?: MssqlCacheStore;
};

export const mssqlCache =
  globalForCache.mssqlCacheInstance || new MssqlCacheStore();

if (process.env.NODE_ENV !== "production") {
  globalForCache.mssqlCacheInstance = mssqlCache;
}
