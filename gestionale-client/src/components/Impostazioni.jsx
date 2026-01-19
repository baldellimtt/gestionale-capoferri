function Impostazioni({ onNavigate, onBack }) {
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="section-title mb-0 no-title-line">Impostazioni</h2>
        <button className="btn btn-secondary" onClick={onBack}>
          Indietro
        </button>
      </div>

      <div className="row g-3">
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Gestione Utenti</h5>
              <p className="card-text">Gestisci gli utenti del sistema, ruoli e permessi.</p>
              <button
                className="btn btn-primary"
                onClick={() => onNavigate('utenti')}
              >
                Apri
              </button>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Dati Aziendali</h5>
              <p className="card-text">Ragione sociale, Partita IVA, Codice Fiscale.</p>
              <button
                className="btn btn-primary"
                onClick={() => onNavigate('dati-aziendali')}
              >
                Apri
              </button>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Dati Fiscali</h5>
              <p className="card-text">Gestisci i dati fiscali dell'azienda.</p>
              <button
                className="btn btn-primary"
                onClick={() => onNavigate('dati-fiscali')}
              >
                Apri
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Impostazioni

