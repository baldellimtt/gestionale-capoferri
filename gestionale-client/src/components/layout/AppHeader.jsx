import React from 'react'

function AppHeader({ user, onLogoClick, onLogout, activeUsersSlot }) {
  return (
    <header>
      <img
        src="/logo-studio-ingegneria-removebg-preview.png"
        alt="Studio Capoferri"
        className="logo"
        onClick={onLogoClick}
        style={{ cursor: 'pointer' }}
        onError={(event) => {
          event.target.style.display = 'none'
        }}
      />
      <div className="header-title">
        <h1>Gestionale</h1>
        {user && (
          <span className="header-sub">Benvenuto, {user.username} ({user.role})</span>
        )}
      </div>
      {user && (
        <div className="header-actions">
          {activeUsersSlot}
          <button
            className="btn btn-secondary"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      )}
    </header>
  )
}

export default AppHeader
