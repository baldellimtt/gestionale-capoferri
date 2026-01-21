/**
 * Script per resettare il rate limiter
 * Utile per sviluppo e troubleshooting
 */

const rateLimiter = require('./rateLimiter');

// Reset rate limiter
rateLimiter.reset();
console.log('Rate limiter resettato');




