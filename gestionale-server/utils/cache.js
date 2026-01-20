/**
 * Cache in-memory semplice
 * Per produzione, considerare Redis
 * Incrementale, non distruttivo
 */

class SimpleCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minuti default
    this.maxSize = options.maxSize || 1000; // Max 1000 entries
    
    // Cleanup periodico
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // Ogni minuto
  }

  /**
   * Ottiene valore dalla cache
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Controlla se scaduto
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Imposta valore in cache
   */
  set(key, value, ttl = this.defaultTTL) {
    // Se cache piena, rimuovi entry più vecchia
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });
  }

  /**
   * Rimuove valore dalla cache
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Pulisce cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Rimuove entry scadute
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Ottiene statistiche cache
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.createdAt,
        expiresIn: entry.expiresAt - Date.now()
      }))
    };
  }
}

// Singleton instance
const cache = new SimpleCache({
  defaultTTL: parseInt(process.env.CACHE_TTL) || 5 * 60 * 1000, // 5 minuti
  maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000
});

module.exports = cache;



