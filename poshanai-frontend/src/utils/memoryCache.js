const DEFAULT_TTL = 5 * 60 * 1000;

export class MemoryCache {
  constructor(defaultTTL = DEFAULT_TTL) {
    if (!Number.isFinite(defaultTTL) || defaultTTL < 0) {
      throw new RangeError('Default cache TTL must be a non-negative finite number.');
    }
    this.defaultTTL = defaultTTL;
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttl = this.defaultTTL) {
    if (!Number.isFinite(ttl) || ttl < 0) {
      throw new RangeError('Cache TTL must be a non-negative finite number.');
    }
    this.entries.set(key, { value, expiresAt: Date.now() + ttl });
    return value;
  }

  has(key) {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  delete(key) {
    return this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }
}

export const memoryCache = new MemoryCache();

export default memoryCache;
