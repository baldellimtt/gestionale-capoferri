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
  const { hash: verifyHash } = hashPassword(password, salt);
  const hashBuffer = Buffer.from(hash, 'hex');
  const verifyBuffer = Buffer.from(verifyHash, 'hex');

  if (hashBuffer.length !== verifyBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashBuffer, verifyBuffer);
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
