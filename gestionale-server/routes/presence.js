const express = require('express');
const crypto = require('crypto');
const Logger = require('../utils/loggerWinston');

const router = express.Router();

function createRouter(db) {
  const upsertPresenceStmt = db.prepare(`
    INSERT INTO utenti_presenze (user_id, session_key, last_seen_at, last_view, user_agent, ip_address)
    VALUES (?, ?, datetime('now', 'localtime'), ?, ?, ?)
    ON CONFLICT(user_id, session_key)
    DO UPDATE SET
      last_seen_at = datetime('now', 'localtime'),
      last_view = excluded.last_view,
      user_agent = excluded.user_agent,
      ip_address = excluded.ip_address,
      updated_at = datetime('now', 'localtime')
  `);

  const cleanupPresenceStmt = db.prepare(`
    DELETE FROM utenti_presenze
    WHERE last_seen_at < datetime('now', '-1 minutes')
  `);
  const deleteOtherPresenceStmt = db.prepare(`
    DELETE FROM utenti_presenze
    WHERE user_id = ? AND session_key != ?
  `);

  const getActiveUsersStmt = db.prepare(`
    SELECT
      u.id,
      u.username,
      u.nome,
      u.cognome,
      u.role,
      MAX(p.last_seen_at) as last_seen_at,
      COUNT(DISTINCT p.session_key) as session_count,
      GROUP_CONCAT(DISTINCT p.last_view) as views
    FROM utenti_presenze p
    JOIN utenti u ON u.id = p.user_id
    WHERE p.last_seen_at >= datetime('now', ?)
    GROUP BY u.id
    ORDER BY last_seen_at DESC
  `);

  const buildSessionKey = (token) => {
    if (!token) return null;
    return crypto.createHash('sha256').update(token).digest('hex');
  };

  router.post('/heartbeat', (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const [, token] = authHeader.split(' ');
      const sessionKeyRaw = typeof req.body?.session_key === 'string'
        ? req.body.session_key.trim()
        : null;
      const sessionKey = buildSessionKey(sessionKeyRaw || token);
      if (!sessionKey) {
        return res.status(401).json({ error: 'Token non valido' });
      }

      const view = typeof req.body?.view === 'string' ? req.body.view.trim() : null;
      const userAgent = req.headers['user-agent'] || null;
      const ipAddress = req.ip || req.connection?.remoteAddress || null;

      upsertPresenceStmt.run(
        req.user.id,
        sessionKey,
        view || null,
        userAgent,
        ipAddress
      );
      // Mantieni una sola sessione attiva per utente (pulizia aggressiva)
      deleteOtherPresenceStmt.run(req.user.id, sessionKey);
      cleanupPresenceStmt.run();

      res.json({ success: true });
    } catch (error) {
      Logger.error('Errore POST /presence/heartbeat', error);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  router.get('/active', (req, res) => {
    try {
      const windowMinutes = Number(req.query.window || 2);
      const safeWindow = Number.isFinite(windowMinutes) && windowMinutes > 0 && windowMinutes <= 60
        ? windowMinutes
        : 2;
      const interval = `-${safeWindow} minutes`;

      const rows = getActiveUsersStmt.all(interval);
      const result = rows.map((row) => ({
        id: row.id,
        username: row.username,
        nome: row.nome || '',
        cognome: row.cognome || '',
        role: row.role,
        last_seen_at: row.last_seen_at,
        session_count: row.session_count || 0,
        views: row.views ? row.views.split(',').filter(Boolean) : []
      }));

      res.json(result);
    } catch (error) {
      Logger.error('Errore GET /presence/active', error);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  return router;
}

module.exports = createRouter;
