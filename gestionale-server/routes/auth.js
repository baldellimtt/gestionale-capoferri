const express = require('express');
const Logger = require('../utils/loggerWinston');
const authMiddleware = require('../utils/authMiddleware');
const { verifyPassword, generateToken, buildSessionExpiry } = require('../utils/auth');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, isJWT } = require('../utils/jwt');
const { defaultPolicy: passwordPolicy } = require('../utils/passwordPolicy');
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
  const updateUserStmt = db.prepare(`
    UPDATE utenti
    SET rimborso_km = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `);

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

      // Salva refresh token in sessione (backward compatibility)
      const customToken = generateToken(); // Token custom per compatibilità
      const expiresAt = buildSessionExpiry();
      createSessionStmt.run(user.id, customToken, expiresAt);

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
          nome: user.nome || '',
          cognome: user.cognome || '',
          mezzo: user.mezzo || '',
          targa: user.targa || '',
          rimborso_km: user.rimborso_km || 0,
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
      
      // Verifica che l'utente esista ancora
      const user = getUserStmt.get(decoded.username);
      if (!user) {
        return res.status(401).json({ error: 'Utente non trovato' });
      }

      // Genera nuovo access token
      const accessToken = generateAccessToken({
        id: user.id,
        username: user.username,
        role: user.role
      });

      Logger.info('Token refresh', { username: user.username });
      return res.json({
        token: accessToken
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
      nome: user?.nome || '',
      cognome: user?.cognome || '',
      mezzo: user?.mezzo || '',
      targa: user?.targa || '',
      rimborso_km: user?.rimborso_km || 0,
    });
  });

  router.put('/me', authMiddleware(db), (req, res) => {
    try {
      const { rimborso_km } = req.body || {};
      const value = Number(rimborso_km);

      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({ error: 'Costo km non valido' });
      }

      updateUserStmt.run(value, req.user.id);
      Logger.info('Aggiornato rimborso km', { username: req.user.username, value });
      return res.json({
        username: req.user.username,
        role: req.user.role,
        rimborso_km: value,
      });
    } catch (error) {
      Logger.error('Errore PUT /auth/me', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  router.post('/logout', authMiddleware(db), (req, res) => {
    try {
      deleteSessionStmt.run(req.user.token);
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
