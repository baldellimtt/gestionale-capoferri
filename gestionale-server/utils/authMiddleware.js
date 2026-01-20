const Logger = require('./loggerWinston');
const { verifyAccessToken, isJWT } = require('./jwt');

function authMiddleware(db) {
  // Prepared statements per backward compatibility con token custom
  const sessionStmt = db.prepare(`
    SELECT s.token, s.expires_at, u.id as user_id, u.username, u.role
    FROM sessioni s
    JOIN utenti u ON u.id = s.user_id
    WHERE s.token = ?
  `);

  const deleteStmt = db.prepare('DELETE FROM sessioni WHERE token = ?');
  const getUserStmt = db.prepare('SELECT id, username, role FROM utenti WHERE username = ?');

  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');

    if (!token) {
      return res.status(401).json({ error: 'Autenticazione richiesta' });
    }

    // Verifica se è un JWT o un token custom
    if (isJWT(token)) {
      // Autenticazione JWT
      try {
        const decoded = verifyAccessToken(token);
        
        // Verifica che l'utente esista ancora
        const user = getUserStmt.get(decoded.username);
        if (!user) {
          return res.status(401).json({ error: 'Utente non trovato' });
        }

        req.user = {
          id: user.id,
          username: user.username,
          role: user.role,
          token: token,
        };

        Logger.debug('Auth JWT ok', { user: user.username });
        return next();
      } catch (error) {
        Logger.warn('JWT verification failed', { error: error.message });
        return res.status(401).json({ error: 'Token non valido o scaduto' });
      }
    } else {
      // Backward compatibility: token custom (sessioni database)
      const session = sessionStmt.get(token);
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

      Logger.debug('Auth session ok', { user: session.username });
      return next();
    }
  };
}

module.exports = authMiddleware;
