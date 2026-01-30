import React from 'react'

const NAV_ITEMS = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'team', label: 'Team' },
  { id: 'commesse', label: 'Commesse' },
  { id: 'tracking', label: 'Tracking ore' },
  { id: 'consuntivi', label: 'Consuntivi' },
  { id: 'anagrafica', label: 'Clienti' }
]

function TopbarNav({ activeView, onChangeView, isAdmin }) {
  return (
    <nav className="topbar-nav">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          className={`topbar-link ${activeView === item.id ? 'active' : ''}`}
          onClick={() => onChangeView(item.id)}
          type="button"
        >
          {item.label}
        </button>
      ))}
      {isAdmin && (
        <button
          className={`topbar-link ${activeView === 'dati-aziendali' ? 'active' : ''}`}
          onClick={() => onChangeView('dati-aziendali')}
          type="button"
        >
          Dati aziendali
        </button>
      )}
    </nav>
  )
}

export default TopbarNav
