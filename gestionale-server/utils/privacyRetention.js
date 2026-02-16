function createPrivacyRetention(db) {
  const stmts = {
    deleteClosedPrivacyRequests: db.prepare(`
      DELETE FROM privacy_requests
      WHERE status IN ('done', 'rejected')
        AND closed_at IS NOT NULL
        AND datetime(closed_at) <= datetime('now', '-' || ? || ' days')
    `),
    deleteOldRefreshTokens: db.prepare(`
      DELETE FROM refresh_tokens
      WHERE (revoked_at IS NOT NULL AND datetime(revoked_at) <= datetime('now', '-' || ? || ' days'))
         OR datetime(expires_at) <= datetime('now', '-' || ? || ' days')
    `),
    deleteOldSessions: db.prepare(`
      DELETE FROM sessioni
      WHERE datetime(expires_at) <= datetime('now', '-' || ? || ' days')
    `),
    deleteOldInvites: db.prepare(`
      DELETE FROM user_invites
      WHERE (
        used_at IS NOT NULL AND datetime(used_at) <= datetime('now', '-' || ? || ' days')
      ) OR (
        revoked_at IS NOT NULL AND datetime(revoked_at) <= datetime('now', '-' || ? || ' days')
      ) OR (
        datetime(expires_at) <= datetime('now', '-' || ? || ' days')
      )
    `),
    countOpenPrivacyRequests: db.prepare(`SELECT COUNT(*) AS count FROM privacy_requests WHERE status IN ('open', 'in_progress', 'waiting_input')`)
  };

  const run = ({ privacyDays, securityDays }) => {
    const safePrivacyDays = Number.isInteger(Number(privacyDays)) && Number(privacyDays) > 0 ? Number(privacyDays) : 730;
    const safeSecurityDays = Number.isInteger(Number(securityDays)) && Number(securityDays) > 0 ? Number(securityDays) : 90;

    const transaction = db.transaction(() => {
      const deletedPrivacyRequests = stmts.deleteClosedPrivacyRequests.run(safePrivacyDays).changes;
      const deletedRefreshTokens = stmts.deleteOldRefreshTokens.run(safeSecurityDays, safeSecurityDays).changes;
      const deletedSessions = stmts.deleteOldSessions.run(safeSecurityDays).changes;
      const deletedInvites = stmts.deleteOldInvites.run(safeSecurityDays, safeSecurityDays, safeSecurityDays).changes;
      const openPrivacyRequests = stmts.countOpenPrivacyRequests.get()?.count || 0;
      return {
        deletedPrivacyRequests,
        deletedRefreshTokens,
        deletedSessions,
        deletedInvites,
        openPrivacyRequests
      };
    });

    return transaction();
  };

  return {
    run
  };
}

module.exports = createPrivacyRetention;
