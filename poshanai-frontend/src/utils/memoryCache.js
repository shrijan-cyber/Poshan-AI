const DEFAULT_TTL = 5 * 60 * 1000;

export class MemoryCache {
  constructor(defaultTTL = DEFAULT_TTL) {
    if (!Number.isFinite(defaultTTL) || defaultTTL < 0) {
      throw new RangeError('Default cache TTL must be a non-negative finite number.');
    }
    this.defaultTTL = defaultTTL;
    this.entries = new Map();
    this.cleanupTimer = null;
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      this.scheduleCleanup();
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttl = this.defaultTTL) {
    if (!Number.isFinite(ttl) || ttl < 0) {
      throw new RangeError('Cache TTL must be a non-negative finite number.');
    }
    this.entries.set(key, { value, expiresAt: Date.now() + ttl });
    this.scheduleCleanup();
    return value;
  }

  has(key) {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      this.scheduleCleanup();
      return false;
    }
    return true;
  }

  delete(key) {
    const deleted = this.entries.delete(key);
    if (deleted) this.scheduleCleanup();
    return deleted;
  }

  clear() {
    this.entries.clear();
    if (this.cleanupTimer !== null) clearTimeout(this.cleanupTimer);
    this.cleanupTimer = null;
  }

  scheduleCleanup() {
    if (this.cleanupTimer !== null) clearTimeout(this.cleanupTimer);
    this.cleanupTimer = null;
    if (this.entries.size === 0) return;

    let nextExpiry = Infinity;
    for (const { expiresAt } of this.entries.values()) {
      nextExpiry = Math.min(nextExpiry, expiresAt);
    }
    const delay = Math.max(0, nextExpiry - Date.now());
    this.cleanupTimer = setTimeout(() => {
      this.cleanupTimer = null;
      this.removeExpiredEntries();
      this.scheduleCleanup();
    }, delay);
    this.cleanupTimer.unref?.();
  }

  removeExpiredEntries() {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}

export const memoryCache = new MemoryCache();
export const clearAllCache = () => memoryCache.clear();

export default memoryCache;
