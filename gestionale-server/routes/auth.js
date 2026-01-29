const express = require('express');
const crypto = require('crypto');
const Logger = require('../utils/loggerWinston');
const authMiddleware = require('../utils/authMiddleware');
const { verifyPassword, generateToken, buildSessionExpiry } = require('../utils/auth');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { validateRequest } = require('../utils/validationMiddleware');
const ValidationSchemas = require('../utils/validationSchemas');

const router = express.Router();

function createRouter(db) {
  const getUserStmt = db.prepare('SELECT * FROM utenti WHERE username = ?');
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

  const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

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

      Logger.info('Login effettuato', { username: user.username, role: user.role });
      return res.json({
        token: accessToken, // JWT access token
        refreshToken, // JWT refresh token
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
      const { refreshToken } = req.body;
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

      Logger.info('Token refresh', { username: user.username });
      return res.json({
        token: accessToken,
        refreshToken: newRefreshToken
      });
    } catch (error) {
      Logger.error('Errore POST /auth/refresh', error);
      return res.status(401).json({ error: 'Refresh token non valido' });
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
      const refreshToken = req.body?.refreshToken;
      if (refreshToken && typeof refreshToken === 'string') {
        const tokenHash = hashToken(refreshToken);
        revokeRefreshTokenStmt.run(null, tokenHash);
      }
      revokeAllRefreshTokensStmt.run(req.user.id);
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
