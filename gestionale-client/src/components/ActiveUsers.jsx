function ActiveUsers({ users = [], loading = false, error = null }) {
  const buildInitials = (user) => {
    const nome = String(user.nome || '').trim();
    const cognome = String(user.cognome || '').trim();
    const username = String(user.username || '').trim();
    if (nome || cognome) {
      return `${nome.charAt(0) || ''}${cognome.charAt(0) || ''}`.toUpperCase() || (username.charAt(0) || 'U').toUpperCase();
    }
    if (username) {
      const parts = username.replace(/[^a-zA-Z]/g, ' ').split(' ').filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return username.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="active-users">
      <div className="active-users-header">
        <div className="active-users-title">Attivi</div>
        <div className="active-users-count">{loading ? '...' : users.length}</div>
      </div>
      {error ? (
        <div className="active-users-error">Presenze non disponibili</div>
      ) : (
        <div className="active-users-avatars">
          {loading && users.length === 0 ? (
            <div className="empty-state">
              <div className="skeleton skeleton-line" style={{ width: '60%' }} />
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Nessuno</div>
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="active-user-avatar"
                data-tooltip={`${user.nome || ''} ${user.cognome || ''}`.trim() || user.username || 'Utente'}
              >
                <span className="active-user-initials">{buildInitials(user)}</span>
                {user.session_count > 1 && (
                  <span className="active-user-badge">{user.session_count}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default ActiveUsers;
