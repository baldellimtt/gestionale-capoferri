const Logger = require('./logger');

function authMiddleware(db) {
  const stmt = db.prepare(`
    SELECT s.token, s.expires_at, u.id as user_id, u.username, u.role
    FROM sessioni s
    JOIN utenti u ON u.id = s.user_id
    WHERE s.token = ?
  `);

  const deleteStmt = db.prepare('DELETE FROM sessioni WHERE token = ?');

  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');

    if (!token) {
      return res.status(401).json({ error: 'Autenticazione richiesta' });
    }

    const session = stmt.get(token);
    if (!session) {
      return res.status(401).json({ error: 'Sessione non valida' });
    }

    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
      deleteStmt.run(token);
      return res.status(401).json({ error: 'Sessione scaduta' });
    }

    req.user = {
      id: session.user_id,
      username: session.username,
      role: session.role,
      token: session.token,
    };

    Logger.info('Auth ok', { user: session.username });
    return next();
  };
}

module.exports = authMiddleware;
