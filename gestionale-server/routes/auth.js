const express = require('express');
const Logger = require('../utils/logger');
const authMiddleware = require('../utils/authMiddleware');
const { verifyPassword, generateToken, buildSessionExpiry } = require('../utils/auth');

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

  router.post('/login', (req, res) => {
    try {
      const { username, password } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({ error: 'Username e password obbligatorie' });
      }

      const user = getUserStmt.get(username);
      if (!user) {
        return res.status(401).json({ error: 'Credenziali non valide' });
      }

      const valid = verifyPassword(password, user.password_salt, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Credenziali non valide' });
      }

      const token = generateToken();
      const expiresAt = buildSessionExpiry();
      createSessionStmt.run(user.id, token, expiresAt);

      Logger.info('Login effettuato', { username: user.username, role: user.role });
      return res.json({
        token,
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
