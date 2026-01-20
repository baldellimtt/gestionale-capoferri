/**
 * Rate Limiter semplice (in-memory)
 * Per produzione, considerare Redis-based
 * Incrementale, non distruttivo
 */

class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.cleanupInterval = null;
  }

  /**
   * Crea middleware rate limiter
   */
  createLimiter(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minuti
      max = 100, // 100 richieste per finestra
      message = 'Troppe richieste, riprova più tardi',
      skipSuccessfulRequests = false
    } = options;

    // Cleanup periodico (ogni ora)
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 60 * 60 * 1000);
    }

    return (req, res, next) => {
      const key = this.getKey(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Ottieni o crea record per questa chiave
      if (!this.requests.has(key)) {
        this.requests.set(key, []);
      }

      const timestamps = this.requests.get(key);
      
      // Rimuovi timestamp fuori dalla finestra
      const validTimestamps = timestamps.filter(ts => ts > windowStart);
      this.requests.set(key, validTimestamps);

      // Controlla limite
      if (validTimestamps.length >= max) {
        res.status(429).json({
          error: message,
          retryAfter: Math.ceil((validTimestamps[0] + windowMs - now) / 1000)
        });
        return;
      }

      // Aggiungi timestamp corrente
      validTimestamps.push(now);
      this.requests.set(key, validTimestamps);

      // Se skipSuccessfulRequests, rimuovi timestamp dopo risposta di successo
      if (skipSuccessfulRequests) {
        const limiter = this;
        const originalSend = res.send;
        res.send = function(data) {
          if (res.statusCode < 400) {
            const timestamps = limiter.requests.get(key) || [];
            if (timestamps.length > 0) {
              timestamps.pop();
              limiter.requests.set(key, timestamps);
            }
          }
          return originalSend.call(this, data);
        };
      }

      next();
    };
  }

  /**
   * Genera chiave univoca per richiesta
   */
  getKey(req) {
    // Usa IP + user ID se autenticato
    const ip = req.ip || req.connection.remoteAddress;
    const userId = req.user?.id || 'anonymous';
    return `${ip}:${userId}`;
  }

  /**
   * Cleanup record vecchi
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 ora

    for (const [key, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(ts => now - ts < maxAge);
      if (validTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }
  }

  /**
   * Reset limiter
   */
  reset() {
    this.requests.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

module.exports = rateLimiter;

