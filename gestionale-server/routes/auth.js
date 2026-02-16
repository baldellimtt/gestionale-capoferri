const express = require('express');
const crypto = require('crypto');
const Logger = require('../utils/loggerWinston');
const authMiddleware = require('../utils/authMiddleware');
const { verifyPassword, generateToken, buildSessionExpiry, hashPassword } = require('../utils/auth');
const { defaultPolicy: passwordPolicy } = require('../utils/passwordPolicy');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { validateRequest } = require('../utils/validationMiddleware');
const ValidationSchemas = require('../utils/validationSchemas');

const router = express.Router();

function createRouter(db) {
  const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || 'gestionale_refresh_token';
  const REFRESH_COOKIE_PATH = process.env.REFRESH_COOKIE_PATH || '/api/auth';
  const REFRESH_COOKIE_DOMAIN = (process.env.REFRESH_COOKIE_DOMAIN || '').trim() || undefined;
  const REFRESH_COOKIE_SECURE = (process.env.REFRESH_COOKIE_SECURE || (process.env.NODE_ENV === 'production' ? 'true' : 'false')).toLowerCase() === 'true';
  const REFRESH_COOKIE_MAX_AGE_MS = Number.parseInt(process.env.REFRESH_COOKIE_MAX_AGE_MS || String(7 * 24 * 60 * 60 * 1000), 10);
  const rawSameSite = String(process.env.REFRESH_COOKIE_SAMESITE || 'lax').toLowerCase();
  const REFRESH_COOKIE_SAMESITE = ['lax', 'strict', 'none'].includes(rawSameSite) ? rawSameSite : 'lax';

  const getUserStmt = db.prepare('SELECT * FROM utenti WHERE username = ?');
  const getUserByIdStmt = db.prepare('SELECT * FROM utenti WHERE id = ?');
  const getUserByEmailStmt = db.prepare('SELECT id, username, email FROM utenti WHERE lower(email) = lower(?) LIMIT 1');
  const createSessionStmt = db.prepare(`
    INSERT INTO sessioni (user_id, token, expires_at)
    VALUES (?, ?, ?)
  `);
  const deleteSessionStmt = db.prepare('DELETE FROM sessioni WHERE token = ?');
  const deletePresenceStmt = db.prepare(`
    DELETE FROM utenti_presenze
    WHERE user_id = ? AND session_key = ?
  `);
  const updateUserStmt = db.prepare(`
    UPDATE utenti
    SET rimborso_km = ?,
        updated_at = datetime('now', 'localtime'),
        row_version = row_version + 1
    WHERE id = ? AND row_version = ?
  `);
  const createRefreshTokenStmt = db.prepare(`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES (?, ?, ?)
  `);
  const getRefreshTokenStmt = db.prepare(`
    SELECT * FROM refresh_tokens
    WHERE token_hash = ?
  `);
  const revokeRefreshTokenStmt = db.prepare(`
    UPDATE refresh_tokens
    SET revoked_at = datetime('now', 'localtime'),
        replaced_by_token_hash = ?
    WHERE token_hash = ?
      AND revoked_at IS NULL
  `);
  const revokeAllRefreshTokensStmt = db.prepare(`
    UPDATE refresh_tokens
    SET revoked_at = datetime('now', 'localtime')
    WHERE user_id = ?
      AND revoked_at IS NULL
  `);
  const deleteExpiredRefreshTokensStmt = db.prepare(`
    DELETE FROM refresh_tokens
    WHERE expires_at <= datetime('now')
  `);
  const getInviteByTokenHashStmt = db.prepare(`
    SELECT id, email, role, invited_nome, invited_cognome, token_hash, expires_at, used_at, revoked_at
    FROM user_invites
    WHERE token_hash = ?
      AND revoked_at IS NULL
      AND used_at IS NULL
  `);
  const markInviteUsedStmt = db.prepare(`
    UPDATE user_invites
    SET used_at = datetime('now', 'localtime'),
        updated_at = datetime('now', 'localtime'),
        row_version = row_version + 1
    WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL
  `);
  const createUserFromInviteStmt = db.prepare(`
    INSERT INTO utenti (username, role, email, telefono, password_hash, password_salt, nome, cognome, mezzo, targa, rimborso_km)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  const parseCookies = (req) => {
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
  };
  const getRefreshCookieOptions = () => {
    const options = {
      httpOnly: true,
      secure: REFRESH_COOKIE_SECURE,
      sameSite: REFRESH_COOKIE_SAMESITE,
      path: REFRESH_COOKIE_PATH
    };
    if (REFRESH_COOKIE_DOMAIN) {
      options.domain = REFRESH_COOKIE_DOMAIN;
    }
    if (Number.isFinite(REFRESH_COOKIE_MAX_AGE_MS) && REFRESH_COOKIE_MAX_AGE_MS > 0) {
      options.maxAge = REFRESH_COOKIE_MAX_AGE_MS;
    }
    return options;
  };
  const getRefreshTokenFromRequest = (req) => {
    const bodyToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '';
    if (bodyToken) return bodyToken;
    const cookies = parseCookies(req);
    return cookies[REFRESH_COOKIE_NAME] || '';
  };

  // Login con JWT (backward compatible con token custom)
  router.post('/login', validateRequest(ValidationSchemas.login), (req, res) => {
    try {
      const { username, password } = req.body;

      Logger.info('Tentativo di login', { username, hasPassword: !!password });

      const user = getUserStmt.get(username);
      if (!user) {
        Logger.warn('Login fallito: utente non trovato', { username });
        return res.status(401).json({ error: 'Credenziali non valide' });
      }

      // Verifica che salt e hash esistano
      if (!user.password_salt || !user.password_hash) {
        Logger.error('Login fallito: password non configurata', { username });
        return res.status(401).json({ error: 'Credenziali non valide' });
      }

      // IMPORTANTE: Rimuovi spazi bianchi iniziali/finali dalla password per evitare problemi
      // Questo risolve il problema quando si copia/incolla la password con spazi
      const trimmedPassword = password.trim();
      
      const valid = verifyPassword(trimmedPassword, user.password_salt, user.password_hash);
      if (!valid) {
        Logger.warn('Login fallito: password non valida', { 
          username,
          passwordLength: trimmedPassword.length,
          hasSalt: !!user.password_salt,
          hasHash: !!user.password_hash
        });
        return res.status(401).json({ error: 'Credenziali non valide' });
      }

      // Genera JWT tokens
      const accessToken = generateAccessToken({
        id: user.id,
        username: user.username,
        role: user.role
      });
      const refreshToken = generateRefreshToken({
        id: user.id,
        username: user.username
      });
      const refreshPayload = verifyRefreshToken(refreshToken);
      const refreshExpiresAt = new Date(refreshPayload.exp * 1000).toISOString();

      // Salva refresh token in sessione (backward compatibility)
      const customToken = generateToken(); // Token custom per compatibilità
      const expiresAt = buildSessionExpiry();
      createSessionStmt.run(user.id, customToken, expiresAt);
      deleteExpiredRefreshTokensStmt.run();
      createRefreshTokenStmt.run(user.id, hashToken(refreshToken), refreshExpiresAt);
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

      Logger.info('Login effettuato', { username: user.username, role: user.role });
      return res.json({
        token: accessToken, // JWT access token
        customToken, // Token custom per backward compatibility
        expiresAt,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email || '',
          telefono: user.telefono || '',
          nome: user.nome || '',
          cognome: user.cognome || '',
          mezzo: user.mezzo || '',
          targa: user.targa || '',
          rimborso_km: user.rimborso_km || 0,
          row_version: user.row_version,
        },
      });
    } catch (error) {
      Logger.error('Errore POST /auth/login', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Refresh token endpoint
  router.post('/refresh', (req, res) => {
    try {
      const refreshToken = getRefreshTokenFromRequest(req);
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token obbligatorio' });
      }

      const decoded = verifyRefreshToken(refreshToken);
      if (decoded.type !== 'refresh') {
        return res.status(401).json({ error: 'Refresh token non valido' });
      }

      const tokenHash = hashToken(refreshToken);
      const stored = getRefreshTokenStmt.get(tokenHash);
      if (!stored || stored.revoked_at) {
        return res.status(401).json({ error: 'Refresh token non valido' });
      }
      if (new Date(stored.expires_at) <= new Date()) {
        revokeRefreshTokenStmt.run(null, tokenHash);
        return res.status(401).json({ error: 'Refresh token scaduto' });
      }
      
      // Verifica che l'utente esista ancora
      const user = getUserStmt.get(decoded.username);
      if (!user) {
        return res.status(401).json({ error: 'Utente non trovato' });
      }
      if (Number(stored.user_id) !== Number(user.id)) {
        return res.status(401).json({ error: 'Refresh token non valido' });
      }

      // Genera nuovi token (rotazione refresh)
      const accessToken = generateAccessToken({
        id: user.id,
        username: user.username,
        role: user.role
      });
      const newRefreshToken = generateRefreshToken({
        id: user.id,
        username: user.username
      });
      const newRefreshPayload = verifyRefreshToken(newRefreshToken);
      const newRefreshExpiresAt = new Date(newRefreshPayload.exp * 1000).toISOString();
      const newTokenHash = hashToken(newRefreshToken);
      createRefreshTokenStmt.run(user.id, newTokenHash, newRefreshExpiresAt);
      revokeRefreshTokenStmt.run(newTokenHash, tokenHash);
      res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, getRefreshCookieOptions());

      Logger.info('Token refresh', { username: user.username });
      return res.json({
        token: accessToken
      });
    } catch (error) {
      Logger.error('Errore POST /auth/refresh', error);
      return res.status(401).json({ error: 'Refresh token non valido' });
    }
  });

  router.get('/invite-info/:token', (req, res) => {
    try {
      const token = String(req.params.token || '').trim();
      if (!token || token.length < 16) {
        return res.status(400).json({ error: 'Token invito non valido' });
      }
      const invite = getInviteByTokenHashStmt.get(hashToken(token));
      if (!invite) {
        return res.status(404).json({ error: 'Invito non trovato o non piu valido' });
      }
      if (new Date(invite.expires_at) <= new Date()) {
        return res.status(410).json({ error: 'Invito scaduto' });
      }
      return res.json({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        nome: invite.invited_nome || '',
        cognome: invite.invited_cognome || '',
        expires_at: invite.expires_at
      });
    } catch (error) {
      Logger.error('Errore GET /auth/invite-info/:token', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  router.post('/accept-invite', (req, res) => {
    try {
      const {
        token,
        username,
        password,
        nome,
        cognome,
        telefono,
        mezzo,
        targa
      } = req.body || {};

      const trimmedToken = String(token || '').trim();
      const trimmedUsername = String(username || '').trim();
      const trimmedPassword = String(password || '').trim();

      if (!trimmedToken || !trimmedUsername || !trimmedPassword) {
        return res.status(400).json({ error: 'token, username e password sono obbligatori' });
      }

      const invite = getInviteByTokenHashStmt.get(hashToken(trimmedToken));
      if (!invite) {
        return res.status(404).json({ error: 'Invito non trovato o non piu valido' });
      }
      if (new Date(invite.expires_at) <= new Date()) {
        return res.status(410).json({ error: 'Invito scaduto' });
      }

      if (!isValidEmail(invite.email)) {
        return res.status(400).json({ error: 'Email invito non valida' });
      }
      if (getUserStmt.get(trimmedUsername)) {
        return res.status(409).json({ error: 'Username gia esistente' });
      }
      if (getUserByEmailStmt.get(invite.email)) {
        return res.status(409).json({ error: 'Esiste gia un utente con questa email' });
      }

      const passwordValidation = passwordPolicy.validate(trimmedPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          error: 'Password non valida',
          details: passwordValidation.errors,
          suggestions: passwordPolicy.getSuggestions()
        });
      }

      const { hash, salt } = hashPassword(trimmedPassword);
      const createTx = db.transaction(() => {
        const userResult = createUserFromInviteStmt.run(
          trimmedUsername,
          invite.role === 'admin' ? 'admin' : 'user',
          invite.email,
          telefono ? String(telefono).trim() : null,
          hash,
          salt,
          nome ? String(nome).trim() : (invite.invited_nome || null),
          cognome ? String(cognome).trim() : (invite.invited_cognome || null),
          mezzo ? String(mezzo).trim() : null,
          targa ? String(targa).trim() : null,
          0
        );

        const inviteUpdate = markInviteUsedStmt.run(invite.id);
        if (inviteUpdate.changes === 0) {
          throw new Error('Invito gia utilizzato o revocato');
        }
        return userResult.lastInsertRowid;
      });

      const userId = createTx();
      const createdUser = getUserByIdStmt.get(userId);
      if (!createdUser) {
        return res.status(500).json({ error: 'Utente creato ma non recuperabile' });
      }

      const accessToken = generateAccessToken({
        id: createdUser.id,
        username: createdUser.username,
        role: createdUser.role
      });
      const refreshToken = generateRefreshToken({
        id: createdUser.id,
        username: createdUser.username
      });
      const refreshPayload = verifyRefreshToken(refreshToken);
      const refreshExpiresAt = new Date(refreshPayload.exp * 1000).toISOString();
      const customToken = generateToken();
      const expiresAt = buildSessionExpiry();
      createSessionStmt.run(createdUser.id, customToken, expiresAt);
      deleteExpiredRefreshTokensStmt.run();
      createRefreshTokenStmt.run(createdUser.id, hashToken(refreshToken), refreshExpiresAt);
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

      Logger.info('Invito accettato e utente creato', { userId: createdUser.id, username: createdUser.username });
      return res.status(201).json({
        token: accessToken,
        customToken,
        expiresAt,
        user: {
          id: createdUser.id,
          username: createdUser.username,
          role: createdUser.role,
          email: createdUser.email || '',
          telefono: createdUser.telefono || '',
          nome: createdUser.nome || '',
          cognome: createdUser.cognome || '',
          mezzo: createdUser.mezzo || '',
          targa: createdUser.targa || '',
          rimborso_km: createdUser.rimborso_km || 0,
          row_version: createdUser.row_version
        }
      });
    } catch (error) {
      if (String(error?.message || '').includes('UNIQUE')) {
        return res.status(409).json({ error: 'Conflitto creazione utente da invito' });
      }
      Logger.error('Errore POST /auth/accept-invite', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  router.get('/me', authMiddleware(db), (req, res) => {
    const user = getUserStmt.get(req.user.username);
    res.json({
      id: user?.id || req.user.id,
      username: req.user.username,
      role: req.user.role,
      email: user?.email || '',
      telefono: user?.telefono || '',
      nome: user?.nome || '',
      cognome: user?.cognome || '',
      mezzo: user?.mezzo || '',
      targa: user?.targa || '',
      rimborso_km: user?.rimborso_km || 0,
      row_version: user?.row_version,
    });
  });

  router.put('/me', authMiddleware(db), (req, res) => {
    try {
      const { rimborso_km, row_version } = req.body || {};
      const value = Number(rimborso_km);

      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({ error: 'Costo km non valido' });
      }
      if (!Number.isInteger(Number(row_version))) {
        return res.status(400).json({ error: 'row_version obbligatorio' });
      }

      const result = updateUserStmt.run(value, req.user.id, row_version);
      if (result.changes === 0) {
        const user = getUserStmt.get(req.user.username);
        if (!user) {
          return res.status(404).json({ error: 'Utente non trovato' });
        }
        return res.status(409).json({ error: 'Conflitto di aggiornamento', current: user });
      }
      Logger.info('Aggiornato rimborso km', { username: req.user.username, value });
      const updated = getUserStmt.get(req.user.username);
      return res.json({
        username: updated?.username || req.user.username,
        role: updated?.role || req.user.role,
        rimborso_km: updated?.rimborso_km ?? value,
        row_version: updated?.row_version,
      });
    } catch (error) {
      Logger.error('Errore PUT /auth/me', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  router.post('/logout', authMiddleware(db), (req, res) => {
    try {
      deleteSessionStmt.run(req.user.token);
      if (req.user?.token) {
        deletePresenceStmt.run(req.user.id, hashToken(req.user.token));
      }
      const customToken = req.body?.customToken;
      if (customToken && typeof customToken === 'string') {
        deletePresenceStmt.run(req.user.id, hashToken(customToken));
      }
      const refreshToken = getRefreshTokenFromRequest(req);
      if (refreshToken && typeof refreshToken === 'string') {
        const tokenHash = hashToken(refreshToken);
        revokeRefreshTokenStmt.run(null, tokenHash);
      }
      revokeAllRefreshTokensStmt.run(req.user.id);
      res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: REFRESH_COOKIE_SECURE,
        sameSite: REFRESH_COOKIE_SAMESITE,
        path: REFRESH_COOKIE_PATH,
        ...(REFRESH_COOKIE_DOMAIN ? { domain: REFRESH_COOKIE_DOMAIN } : {})
      });
      Logger.info('Logout effettuato', { username: req.user.username });
      res.json({ success: true });
    } catch (error) {
      Logger.error('Errore POST /auth/logout', error);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  return router;
}

module.exports = createRouter;
