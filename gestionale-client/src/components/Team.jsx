import { useEffect, useMemo, useState } from 'react'
import TabellaAttivita from './TabellaAttivita'
import NoteSpese from './NoteSpese'
import ImpostazioniUtenti from './ImpostazioniUtenti'

function Team({ utenti = [], user, clienti = [], toast, onUserUpdated, onUsersChanged }) {
  const [activeSection, setActiveSection] = useState(null)
  const [members, setMembers] = useState([])
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [noteSpeseOpenKey, setNoteSpeseOpenKey] = useState(0)

  const teamMembers = useMemo(() => {
    if (utenti.length > 0) return utenti
    return user ? [user] : []
  }, [utenti, user])

  useEffect(() => {
    setMembers(teamMembers)
  }, [teamMembers])

  const canEditUsers = user?.role === 'admin'
  const selectedMember = members.find((member) => member?.id === selectedMemberId) || null

  const handleOpenSection = (member, section) => {
    if (!member?.id) return
    setSelectedMemberId(member.id)
    setActiveSection(section)
    if (section === 'note-spese') {
      setNoteSpeseOpenKey((prev) => prev + 1)
    }
  }

  return (
    <div className="team-section">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="section-title mb-0 no-title-line">Team</h2>
        {canEditUsers && (
          <button
            type="button"
            className={`btn btn-sm ${showUserManagement ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowUserManagement((prev) => !prev)}
          >
            Gestione utenti
          </button>
        )}
      </div>

      <div className="team-grid">
        {members.map((member) => {
          const fullName = [member?.nome, member?.cognome].filter(Boolean).join(' ').trim()
          const isActive = selectedMemberId && member?.id === selectedMemberId
          return (
            <div
              key={member.id || member.username}
              className={`team-card ${isActive ? 'is-active' : ''}`}
            >
              <div className="team-card-title">{fullName || member.username || 'Profilo'}</div>
              <div className="team-card-meta-list">
                {member.email && (
                  <div className="team-card-meta">
                    <span className="team-card-meta-label">Email</span>
                    <span className="team-card-meta-value">{member.email}</span>
                  </div>
                )}
                {member.telefono && (
                  <div className="team-card-meta">
                    <span className="team-card-meta-label">Telefono</span>
                    <span className="team-card-meta-value">{member.telefono}</span>
                  </div>
                )}
              </div>
              <div className="team-card-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleOpenSection(member, 'rimborsi')
                  }}
                >
                  Rimborsi
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleOpenSection(member, 'note-spese')
                  }}
                >
                  Nota spese
                </button>
              </div>
            </div>
          )
        })}
        {members.length === 0 && (
          <div className="alert alert-info mb-0">
            Nessun membro team disponibile.
          </div>
      )}
      </div>

      {showUserManagement && canEditUsers && (
        <div className="team-section-panel mt-3">
          <div className="team-panel-header">
            <h3 className="team-panel-title">Gestione utenti</h3>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowUserManagement(false)}>
              Chiudi
            </button>
          </div>
          <ImpostazioniUtenti
            currentUser={user}
            onUserUpdated={onUserUpdated}
            onUsersChanged={onUsersChanged}
            toast={toast}
            showHeader={false}
            title="Gestione utenti"
          />
        </div>
      )}

      {selectedMember && (
        <div className="team-section-panel mt-3">
          <>
            {activeSection === 'rimborsi' && (
              <TabellaAttivita clienti={clienti} user={selectedMember || user} toast={toast} targetUserId={selectedMember?.id || null} />
            )}
            {activeSection === 'note-spese' && (
              <NoteSpese selectedMember={selectedMember || user} currentUser={user} toast={toast} openKey={noteSpeseOpenKey} />
            )}
          </>
        </div>
      )}
    </div>
  )
}

export default Team
