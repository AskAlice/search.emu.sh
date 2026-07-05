/**
 * Simple In-Memory Cache
 * 
 * A lightweight cache implementation with TTL support.
 */

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

export class SimpleCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTtl: number;
  
  /**
   * Create a new cache
   * @param ttlSeconds Default TTL in seconds
   */
  constructor(ttlSeconds: number = 300) {
    this.defaultTtl = ttlSeconds * 1000; // Convert to milliseconds
    
    // Periodic cleanup every minute
    setInterval(() => this.cleanup(), 60000);
  }
  
  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }
  
  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttlSeconds Optional TTL override in seconds
   */
  set(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtl;
    
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl,
    });
  }
  
  /**
   * Delete a value from the cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
  
  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }
  
  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

export default SimpleCache;
