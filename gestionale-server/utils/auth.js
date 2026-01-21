const crypto = require('crypto');

const HASH_ITERATIONS = 120000;
const HASH_KEYLEN = 64;
const HASH_DIGEST = 'sha512';

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEYLEN, HASH_DIGEST)
    .toString('hex');

  return { hash, salt };
}

function verifyPassword(password, salt, hash) {
  // Verifica input validi
  if (!password || !salt || !hash) {
    return false;
  }

  // Assicurati che salt e hash siano stringhe valide
  if (typeof salt !== 'string' || typeof hash !== 'string') {
    return false;
  }

  try {
    const { hash: verifyHash } = hashPassword(password, salt);
    const hashBuffer = Buffer.from(hash, 'hex');
    const verifyBuffer = Buffer.from(verifyHash, 'hex');

    if (hashBuffer.length !== verifyBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuffer, verifyBuffer);
  } catch (error) {
    // In caso di errore (es. salt/hash non validi), ritorna false
    console.error('Errore verifica password:', error);
    return false;
  }
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function buildSessionExpiry(days = 7) {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return expires.toISOString();
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  buildSessionExpiry,
};
