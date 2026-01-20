/**
 * JWT Utilities
 * Incrementale, non distruttivo
 * Supporta sia JWT che token custom (backward compatibility)
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRATION || process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRATION || process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Genera JWT access token
 */
function generateAccessToken(payload) {
  return jwt.sign(
    {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      type: 'access'
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'gestionale-capoferri',
      audience: 'gestionale-client'
    }
  );
}

/**
 * Genera JWT refresh token
 */
function generateRefreshToken(payload) {
  return jwt.sign(
    {
      id: payload.id,
      username: payload.username,
      type: 'refresh'
    },
    JWT_REFRESH_SECRET,
    {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'gestionale-capoferri',
      audience: 'gestionale-client'
    }
  );
}

/**
 * Verifica JWT access token
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'gestionale-capoferri',
      audience: 'gestionale-client'
    });
  } catch (error) {
    throw new Error('Token non valido o scaduto');
  }
}

/**
 * Verifica JWT refresh token
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'gestionale-capoferri',
      audience: 'gestionale-client'
    });
  } catch (error) {
    throw new Error('Refresh token non valido o scaduto');
  }
}

/**
 * Genera token custom (backward compatibility)
 */
function generateCustomToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Determina se un token è JWT o custom
 */
function isJWT(token) {
  try {
    // JWT ha formato: header.payload.signature (3 parti separate da .)
    const parts = token.split('.');
    return parts.length === 3;
  } catch {
    return false;
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateCustomToken,
  isJWT,
  JWT_SECRET,
  JWT_REFRESH_SECRET
};

