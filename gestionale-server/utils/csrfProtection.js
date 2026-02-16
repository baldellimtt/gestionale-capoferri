const crypto = require('crypto');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function parseCookies(req) {
  const header = String(req.headers.cookie || '');
  if (!header) return {};
  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf('=');
      if (index <= 0) return acc;
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (!key) return acc;
      try {
        acc[key] = decodeURIComponent(value);
      } catch {
        acc[key] = value;
      }
      return acc;
    }, {});
}

function normalizeOrigin(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value).trim());
    return url.origin.toLowerCase();
  } catch {
    return '';
  }
}

function parseAllowedOrigins() {
  const origins = new Set();
  const corsOrigin = String(process.env.CORS_ORIGIN || '').trim();
  if (corsOrigin && corsOrigin !== '*') {
    corsOrigin
      .split(',')
      .map((item) => normalizeOrigin(item))
      .filter(Boolean)
      .forEach((origin) => origins.add(origin));
  }

  const appBase = normalizeOrigin(process.env.APP_BASE_URL || '');
  if (appBase) origins.add(appBase);

  if ((process.env.NODE_ENV || 'development') !== 'production') {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
    origins.add('http://localhost:4173');
    origins.add('http://127.0.0.1:4173');
  }

  return origins;
}

function getRequestOrigin(req) {
  const directOrigin = normalizeOrigin(req.headers.origin || '');
  if (directOrigin) return directOrigin;
  const refererOrigin = normalizeOrigin(req.headers.referer || '');
  return refererOrigin || '';
}

function createCsrfProtection() {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const cookieName = process.env.CSRF_COOKIE_NAME || 'gestionale_csrf_token';
  const cookiePath = process.env.CSRF_COOKIE_PATH || '/api';
  const cookieDomain = (process.env.CSRF_COOKIE_DOMAIN || '').trim() || undefined;
  const secure = (process.env.CSRF_COOKIE_SECURE || (NODE_ENV === 'production' ? 'true' : 'false')).toLowerCase() === 'true';
  const rawSameSite = String(process.env.CSRF_COOKIE_SAMESITE || 'lax').toLowerCase();
  const sameSite = ['lax', 'strict', 'none'].includes(rawSameSite) ? rawSameSite : 'lax';
  const enforceOrigin = (process.env.CSRF_ENFORCE_ORIGIN || 'true').toLowerCase() === 'true';
  const allowedOrigins = parseAllowedOrigins();
  const exemptPaths = new Set([
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/accept-invite',
    '/api/auth/logout'
  ]);

  const cookieOptions = {
    httpOnly: false,
    secure,
    sameSite,
    path: cookiePath
  };
  if (cookieDomain) {
    cookieOptions.domain = cookieDomain;
  }

  const issueToken = (req, res, next) => {
    const cookies = parseCookies(req);
    const existing = String(cookies[cookieName] || '').trim();
    if (existing) {
      req.csrfToken = existing;
      return next();
    }

    const token = crypto.randomBytes(24).toString('hex');
    req.csrfToken = token;
    res.cookie(cookieName, token, cookieOptions);
    return next();
  };

  const verifyRequest = (req, res, next) => {
    const method = String(req.method || 'GET').toUpperCase();
    if (!MUTATING_METHODS.has(method)) {
      return next();
    }

    const fullPath = req.originalUrl ? String(req.originalUrl).split('?')[0] : req.path;
    if (exemptPaths.has(fullPath)) {
      return next();
    }

    if (enforceOrigin) {
      const requestOrigin = getRequestOrigin(req);
      if (requestOrigin && allowedOrigins.size > 0 && !allowedOrigins.has(requestOrigin)) {
        return res.status(403).json({ error: 'Origine richiesta non consentita' });
      }
    }

    const cookies = parseCookies(req);
    const cookieToken = String(cookies[cookieName] || '').trim();
    const headerToken = String(req.headers['x-csrf-token'] || '').trim();

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return res.status(403).json({ error: 'Token CSRF mancante o non valido' });
    }

    return next();
  };

  return {
    issueToken,
    verifyRequest
  };
}

module.exports = createCsrfProtection;
