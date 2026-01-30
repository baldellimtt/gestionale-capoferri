import React from 'react'

function CommessaForm({
  editingId,
  onOpenTracking,
  formTab,
  setFormTab,
  formData,
  setFormData,
  allowClienteEdit,
  setAllowClienteEdit,
  clienteFormInput,
  showClienteFormAutocomplete,
  setShowClienteFormAutocomplete,
  filteredClientiForm,
  handleClienteFormInputChange,
  handleClienteChange,
  statiCommessa,
  statiPagamenti,
  tipiLavoro,
  toggleTipologia,
  addCustomTipologia,
  getStatoClass,
  getStatoPagamentiClass,
  utenti,
  getUtenteLabel,
  isConsuntivoPagamenti,
  formYearFolderOptions,
  selectedFormYear
}) {
  return (
    <div className="card mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <span>
          {editingId
            ? `Scheda Commessa${formData?.titolo ? ` - ${formData.titolo}` : ''}`
            : 'Nuova commessa'}
        </span>
        {editingId && onOpenTracking && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onOpenTracking(editingId)}
          >
            Tracking ore
          </button>
        )}
      </div>
      <div className="card-body">
        <div className="commessa-form-tabs">
          <button
            type="button"
            className={`btn btn-sm ${formTab === 'essenziali' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFormTab('essenziali')}
          >
            Essenziali
          </button>
          <button
            type="button"
            className={`btn btn-sm ${formTab === 'dettagli' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFormTab('dettagli')}
          >
            Dettagli
          </button>
        </div>
        <div className="row g-3">
          {formTab === 'essenziali' && (
          <>
            <div className="col-md-6">
            <label className="form-label">Titolo commessa</label>
            <input
              className="form-control"
              value={formData.titolo}
              onChange={(e) => setFormData((prev) => ({ ...prev, titolo: e.target.value }))}
            />
          </div>
          <div className={`col-md-3 importo-pagato-row ${isConsuntivoPagamenti ? 'is-consuntivo' : ''}`}>
            <div className="d-flex align-items-center justify-content-between commessa-form-label-row">
              <label className="form-label mb-0">Cliente</label>
              {!allowClienteEdit && (
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0"
                  onClick={() => setAllowClienteEdit(true)}
                >
                  Cambia cliente
                </button>
              )}
            </div>
            <div className="autocomplete-container">
              <input
                className="form-control"
                value={clienteFormInput}
                onChange={(e) => {
                  handleClienteFormInputChange(e.target.value)
                  setShowClienteFormAutocomplete(true)
                }}
                onFocus={() => setShowClienteFormAutocomplete(true)}
                onBlur={() => {
                  setTimeout(() => setShowClienteFormAutocomplete(false), 200)
                }}
                placeholder="Cerca cliente..."
                disabled={!allowClienteEdit}
                style={!allowClienteEdit ? { backgroundColor: '#f1f3f5', color: '#6c757d' } : undefined}
              />
              {showClienteFormAutocomplete && filteredClientiForm.length > 0 && (
                <div className="autocomplete-list">
                  {filteredClientiForm.map((cliente) => (
                    <div
                      key={cliente.id}
                      className="autocomplete-item"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleClienteChange(cliente.id)
                        setShowClienteFormAutocomplete(false)
                      }}
                    >
                      {cliente.denominazione}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="col-md-3">
            <label className="form-label">Stato</label>
            <select
              className={`form-select stato-select ${getStatoClass(formData.stato)}`}
              value={formData.stato}
              onChange={(e) => setFormData((prev) => ({ ...prev, stato: e.target.value }))}
            >
              {statiCommessa.map((stato) => (
                <option key={stato} value={stato}>{stato}</option>
              ))}
            </select>
          </div>
          {formData.stato !== 'Conclusa' && (
            <div className="col-12">
              <label className="form-label">Tipologia di lavoro</label>
              <div className="tipologie-lavoro-grid">
                {tipiLavoro.map((tipologia) => (
                  <label key={tipologia} className="form-check form-check-inline tipologia-item">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={formData.sotto_stato.includes(tipologia)}
                      onChange={() => toggleTipologia(tipologia)}
                    />
                    <span className="form-check-label">{tipologia}</span>
                  </label>
                ))}
              </div>
              <div className="tipologia-custom-row">
                <input
                  className="form-control"
                  value={formData.sotto_stato_custom}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sotto_stato_custom: e.target.value }))}
                  placeholder="Aggiungi tipologia personalizzata"
                />
                <button type="button" className="btn btn-secondary" onClick={addCustomTipologia}>
                  Aggiungi
                </button>
              </div>
              {formData.sotto_stato.some((item) => !tipiLavoro.includes(item)) && (
                <div className="tipologia-custom-tags">
                  {formData.sotto_stato
                    .filter((item) => !tipiLavoro.includes(item))
                    .map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="tipologia-tag"
                        onClick={() => toggleTipologia(item)}
                      >
                        {item} ×
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
          {!editingId && formYearFolderOptions.length > 0 && (
            <>
              <div className="col-md-4">
                <label className="form-label">Cartella</label>
                <select
                  className="form-select"
                  value={selectedFormYear}
                  onChange={(e) => {
                    const year = e.target.value
                    setFormData((prev) => ({
                      ...prev,
                      data_inizio: year ? `${year}-01-01` : ''
                    }))
                  }}
                >
                  <option value="">Seleziona cartella</option>
                  {formYearFolderOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              {(!!formData.parent_commessa_id || !!formData.is_struttura) ? (
                <div className="col-12">
                  {formData.parent_commessa_id && (
                    <div className="alert alert-info d-flex justify-content-between align-items-center mb-2">
                      <span>
                        Sottocommessa di <strong>{formData.parent_commessa_title || 'Commessa padre'}</strong>
                      </span>
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0"
                        onClick={() => setFormData((prev) => ({ ...prev, parent_commessa_id: '', parent_commessa_title: '' }))}
                      >
                        Rimuovi
                      </button>
                    </div>
                  )}
                  <div className="form-check form-switch">
                    <input
                      id="commessa-structure-switch"
                      type="checkbox"
                      className="form-check-input"
                      checked={!!formData.is_struttura}
                      onChange={(e) => setFormData((prev) => ({ ...prev, is_struttura: e.target.checked }))}
                    />
                    <label className="form-check-label" htmlFor="commessa-structure-switch">
                      Usa come struttura di sottocommesse
                    </label>
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                    Attiva per aprire una lista di sottocommesse quando clicchi sulla riga nella lista.
                  </div>
                </div>
              ) : null}
            </>
          )}
          <div className="col-md-4">
            <label className="form-label">Data inizio</label>
            <input
              type="date"
              className="form-control"
              value={formData.data_inizio}
              onChange={(e) => setFormData((prev) => ({ ...prev, data_inizio: e.target.value }))}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Data fine</label>
            <input
              type="date"
              className="form-control"
              value={formData.data_fine}
              onChange={(e) => setFormData((prev) => ({ ...prev, data_fine: e.target.value }))}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Responsabile</label>
            <select
              className="form-select"
              value={formData.responsabile}
              onChange={(e) => setFormData((prev) => ({ ...prev, responsabile: e.target.value }))}
            >
              <option value="">Seleziona responsabile</option>
              {utenti.map((utente) => {
                const label = getUtenteLabel(utente)
                return (
                  <option key={utente.id} value={label}>
                    {label}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Ubicazione</label>
            <input
              className="form-control"
              value={formData.ubicazione}
              onChange={(e) => setFormData((prev) => ({ ...prev, ubicazione: e.target.value }))}
              placeholder="Es. Via Roma, Milano"
            />
          </div>
          </>
          )}
          {formTab === 'dettagli' && (
          <>
          <div className="col-md-3">
            <label className="form-label">Preventivo</label>
            <select
              className="form-select"
              value={formData.preventivo ? 'si' : 'no'}
              onChange={(e) => {
                const isPreventivo = e.target.value === 'si'
                setFormData((prev) => ({
                  ...prev,
                  preventivo: isPreventivo,
                  importo_preventivo: isPreventivo ? prev.importo_preventivo : ''
                }))
              }}
            >
              <option value="si">Sì</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">Importo preventivo (€)</label>
            <input
              className="form-control"
              value={formData.importo_preventivo}
              onChange={(e) => setFormData((prev) => ({ ...prev, importo_preventivo: e.target.value }))}
              inputMode="decimal"
              placeholder="0.00"
              disabled={!formData.preventivo}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Importo totale (€)</label>
            <input
              className="form-control"
              value={formData.importo_totale}
              onChange={(e) => setFormData((prev) => ({ ...prev, importo_totale: e.target.value }))}
              inputMode="decimal"
              placeholder="0.00"
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Importo pagato (€)</label>
            <input
              className="form-control"
              value={formData.importo_pagato}
              onChange={(e) => setFormData((prev) => ({ ...prev, importo_pagato: e.target.value }))}
              inputMode="decimal"
              placeholder="0.00"
              disabled={isConsuntivoPagamenti}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Monte ore stimato</label>
            <input
              type="number"
              className="form-control"
              value={formData.monte_ore_stimato}
              onChange={(e) => setFormData((prev) => ({ ...prev, monte_ore_stimato: e.target.value }))}
              inputMode="decimal"
              min="0"
              step="0.25"
              placeholder="Es. 40"
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Stato pagamenti</label>
            <select
              className={`form-select stato-pagamenti-select ${getStatoPagamentiClass(formData.stato_pagamenti)}`}
              value={formData.stato_pagamenti}
              onChange={(e) => setFormData((prev) => ({ ...prev, stato_pagamenti: e.target.value }))}
            >
              {statiPagamenti.map((stato) => (
                <option key={stato} value={stato}>{stato}</option>
              ))}
            </select>
          </div>
          </>
          )}
        </div>
        <div className="row g-3 mt-3">
          <div className="col-md-6">
            <label className="form-label">Note</label>
            <textarea
              className="form-control"
              rows="3"
              value={formData.note}
              onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
            />
          </div>
          <div className="col-md-6">
            <label className="form-label">Riferimenti (link o note extra)</label>
            <textarea
              className="form-control"
              rows="3"
              value={formData.allegati}
              onChange={(e) => setFormData((prev) => ({ ...prev, allegati: e.target.value }))}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default CommessaForm
