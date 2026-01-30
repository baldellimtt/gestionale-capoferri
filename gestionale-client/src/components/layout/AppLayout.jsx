import React from 'react'

function AppLayout({ nav, children }) {
  return (
    <div className="app-layout">
      {nav}
      <div className="content-col">
        <main className="content-area">
          {children}
        </main>
      </div>
    </div>
  )
}

export default AppLayout
