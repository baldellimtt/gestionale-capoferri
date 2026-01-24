import React from 'react'

function CommessaAuditPanel({
  selectedCommessaId,
  showCommessaAudit,
  onToggle,
  auditNoteDate,
  onChangeDate,
  auditNoteText,
  onChangeText,
  onAddNote,
  auditNoteSaving,
  commessaAuditLoading,
  commessaAuditError,
  commessaAudit,
  formatAuditAction,
  formatAuditUser,
  getAuditUserBadgeStyle,
  formatAuditDate,
  getAuditChangeList,
  formatFieldLabel,
  formatChangeValue
}) {
  return (
    <div className="card mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span>Cronologia commessa</span>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={onToggle}
          disabled={!selectedCommessaId}
        >
          {showCommessaAudit ? 'Nascondi' : 'Mostra'}
        </button>
      </div>
      <div className="card-body">
        {!selectedCommessaId && (
          <div className="alert alert-info mb-0">Seleziona una commessa per vedere la cronologia.</div>
        )}
        {selectedCommessaId && showCommessaAudit && (
          <>
            <div className="row g-2 align-items-end mb-3">
              <div className="col-md-3">
                <label className="form-label">Data</label>
                <input
                  type="date"
                  className="form-control"
                  value={auditNoteDate}
                  onChange={(e) => onChangeDate(e.target.value)}
                />
              </div>
              <div className="col-md-7">
                <label className="form-label">Nota</label>
                <input
                  className="form-control"
                  value={auditNoteText}
                  onChange={(e) => onChangeText(e.target.value)}
                  placeholder="Es. relazione inviata"
                />
              </div>
              <div className="col-md-2 d-grid">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onAddNote}
                  disabled={auditNoteSaving}
                >
                  {auditNoteSaving ? 'Salvataggio...' : 'Aggiungi'}
                </button>
              </div>
            </div>
            {commessaAuditLoading && (
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                Caricamento cronologia...
              </div>
            )}
            {commessaAuditError && (
              <div className="alert alert-warning mb-0">
                {commessaAuditError}
              </div>
            )}
            {!commessaAuditLoading && !commessaAuditError && commessaAudit.length === 0 && (
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                Nessuna modifica registrata.
              </div>
            )}
            {!commessaAuditLoading && !commessaAuditError && commessaAudit.length > 0 && (
              <div className="audit-list">
                {commessaAudit.map((entry) => (
                  <div key={entry.id} className="audit-item card">
                    <div className="audit-header">
                      <div>
                        <div className="audit-title">{formatAuditAction(entry)}</div>
                        <div className="audit-meta d-flex align-items-center gap-2 flex-wrap">
                          <span>Da:</span>
                          <span className="badge-chip audit-user-badge" style={getAuditUserBadgeStyle(entry)}>
                            {formatAuditUser(entry)}
                          </span>
                        </div>
                      </div>
                      <div className="audit-meta">{formatAuditDate(entry.created_at)}</div>
                    </div>
                    {entry.action === 'note' && entry.changes && typeof entry.changes === 'object' && (
                      <div className="audit-changes">
                        {entry.changes.date && (
                          <div>Data nota: {formatAuditDate(entry.changes.date)}</div>
                        )}
                        <div>{entry.changes.note || entry.changes.nota || '-'}</div>
                      </div>
                    )}
                    {getAuditChangeList(entry).length > 0 && (
                      <div className="audit-changes">
                        {getAuditChangeList(entry).map((change, idx) => (
                          <div key={`${entry.id}-change-${idx}`}>
                            {formatFieldLabel(change.field)}: {formatChangeValue(change.from, change.field)}
                            {' -> '}
                            {formatChangeValue(change.to, change.field)}
                          </div>
                        ))}
                      </div>
                    )}
                    {!Array.isArray(entry.changes) && entry.changes && entry.action?.startsWith('attachment') && (
                      <div className="audit-changes">
                        <div>Allegato: {entry.changes.original_name || 'N/D'}</div>
                        {entry.changes.version && (
                          <div>Versione: {entry.changes.version}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default CommessaAuditPanel
