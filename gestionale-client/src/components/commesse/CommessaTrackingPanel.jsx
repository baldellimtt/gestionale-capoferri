import React from 'react'

const formatTrackingDate = (value) => {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

const roundUpToHalfHour = (hoursValue) => {
  if (!Number.isFinite(hoursValue) || hoursValue <= 0) return 0
  return Math.ceil(hoursValue * 2) / 2
}

const formatTrackingHours = (minutes) => {
  if (!Number.isFinite(minutes)) return '0.00'
  return roundUpToHalfHour(minutes / 60).toFixed(2)
}

const getUserLabel = (entry) => {
  return [entry?.nome, entry?.cognome].filter(Boolean).join(' ') || entry?.username || '-'
}

function CommessaTrackingPanel({ tracking, loading, error, onOpenTracking, editingId }) {
  return (
    <div className="card mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span>Tracking ore commessa</span>
        {onOpenTracking && editingId && (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => onOpenTracking(editingId)}
          >
            Apri tracking ore
          </button>
        )}
      </div>
      <div className="card-body">
        {error && (
          <div className="alert alert-warning">{error}</div>
        )}
        {loading && (
          <div className="text-muted">Caricamento tracking...</div>
        )}
        {!loading && tracking && (
          <>
            <div className="d-flex gap-4 flex-wrap mb-2">
              <div>
                <div className="text-muted" style={{ fontSize: '0.85rem' }}>Ore registrate</div>
                <div className="fw-semibold">
                  {formatTrackingHours(tracking.total_minuti || 0)} h
                </div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: '0.85rem' }}>Voci</div>
                <div className="fw-semibold">{(tracking.entries || []).length}</div>
              </div>
            </div>
            {(tracking.entries || []).length === 0 ? (
              <div className="text-muted">Nessuna ora registrata.</div>
            ) : (
              <div className="attivita-table-scroll">
                <table className="table table-striped commesse-table">
                  <thead className="table-dark visually-hidden">
                    <tr>
                      <th>Data</th>
                      <th>Ore</th>
                      <th>Utente</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracking.entries.slice(0, 5).map((entry) => (
                      <tr key={entry.id}>
                        <td><div className="commessa-meta">{formatTrackingDate(entry.data)}</div></td>
                        <td><div className="commessa-meta">{formatTrackingHours(entry.durata_minuti)} h</div></td>
                        <td><div className="commessa-meta">{getUserLabel(entry)}</div></td>
                        <td><div className="commessa-meta">{entry.note || '-'}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        {!loading && !tracking && !error && (
          <div className="text-muted">Nessun dato disponibile.</div>
        )}
      </div>
    </div>
  )
}

export default CommessaTrackingPanel
