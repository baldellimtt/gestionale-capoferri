import { useEffect, useState } from 'react'
import api from '../services/api'

const REGIMI_FISCALI = [
  'Regime ordinario',
  'Regime semplificato',
  'Regime forfettario',
  'Regime agevolato',
  'Startup innovativa'
]

const TIPI_DOCUMENTO = [
  { value: 'TD01', label: 'TD01 - Fattura' },
  { value: 'TD02', label: 'TD02 - Acconto/Anticipo su fattura' },
  { value: 'TD03', label: 'TD03 - Acconto/Anticipo su parcella' },
  { value: 'TD04', label: 'TD04 - Nota di credito' },
  { value: 'TD05', label: 'TD05 - Nota di debito' },
  { value: 'TD06', label: 'TD06 - Parcella' }
]

const PROVINCE_ITALIA = [
  'AG', 'AL', 'AN', 'AO', 'AR', 'AP', 'AT', 'AV', 'BA', 'BT', 'BL', 'BN', 'BG', 'BI', 'BO',
  'BZ', 'BS', 'BR', 'CA', 'CL', 'CB', 'CI', 'CE', 'CT', 'CZ', 'CH', 'CO', 'CS', 'CR', 'KR',
  'CN', 'EN', 'FM', 'FE', 'FI', 'FG', 'FC', 'FR', 'GE', 'GO', 'GR', 'IM', 'IS', 'SP', 'AQ',
  'LT', 'LE', 'LC', 'LI', 'LO', 'LU', 'MC', 'MN', 'MS', 'MT', 'VS', 'ME', 'MI', 'MO', 'MB',
  'NA', 'NO', 'NU', 'OG', 'OT', 'PD', 'PA', 'PR', 'PV', 'PG', 'PU', 'PE', 'PC', 'PI', 'PT',
  'PN', 'PZ', 'PO', 'RG', 'RA', 'RC', 'RE', 'RI', 'RN', 'RM', 'RO', 'SA', 'SS', 'SV', 'SI',
  'SR', 'SO', 'SU', 'TA', 'TE', 'TR', 'TO', 'TP', 'TN', 'TV', 'TS', 'UD', 'VA', 'VE', 'VB',
  'VC', 'VR', 'VV', 'VI', 'VT'
]

function DatiFiscali({ onBack, toast }) {
  const [formData, setFormData] = useState({
    codice_destinatario_sdi: '',
    pec: '',
    regime_fiscale: '',
    codice_ateco: '',
    numero_rea: '',
    provincia_rea: '',
    ufficio_iva: '',
    iban: '',
    banca: '',
    tipo_documento_predefinito: '',
    ritenuta_acconto: '',
    rivalsa_inps: '',
    cassa_previdenziale: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getDatiFiscali()
      setFormData({
        codice_destinatario_sdi: data.codice_destinatario_sdi || '',
        pec: data.pec || '',
        regime_fiscale: data.regime_fiscale || '',
        codice_ateco: data.codice_ateco || '',
        numero_rea: data.numero_rea || '',
        provincia_rea: data.provincia_rea || '',
        ufficio_iva: data.ufficio_iva || '',
        iban: data.iban || '',
        banca: data.banca || '',
        tipo_documento_predefinito: data.tipo_documento_predefinito || '',
        ritenuta_acconto: data.ritenuta_acconto ? String(data.ritenuta_acconto) : '',
        rivalsa_inps: data.rivalsa_inps ? String(data.rivalsa_inps) : '',
        cassa_previdenziale: data.cassa_previdenziale || ''
      })
    } catch (err) {
      console.error('Errore caricamento dati fiscali:', err)
      setError('Errore nel caricamento dei dati fiscali.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)
      const loadingToastId = toast?.showLoading('Salvataggio in corso...', 'Salvataggio dati fiscali')
      await api.updateDatiFiscali(formData)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Dati fiscali aggiornati con successo', duration: 3000 })
      } else {
        toast?.showSuccess('Dati fiscali aggiornati con successo')
      }
    } catch (err) {
      console.error('Errore salvataggio dati fiscali:', err)
      const errorMsg = err.message || 'Errore nel salvataggio dei dati fiscali.'
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="section-title mb-0">Dati Fiscali</h2>
          <button className="btn btn-secondary" onClick={onBack}>
            Indietro
          </button>
        </div>
        <div className="text-center py-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Caricamento...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="section-title mb-0">Dati Fiscali</h2>
        <button className="btn btn-secondary" onClick={onBack}>
          Indietro
        </button>
      </div>

      {error && (
        <div className="alert alert-warning mb-3">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success mb-3">
          Dati salvati con successo!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">Fatturazione Elettronica</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Codice Destinatario SDI</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.codice_destinatario_sdi}
                  onChange={(e) => setFormData((prev) => ({ ...prev, codice_destinatario_sdi: e.target.value }))}
                  placeholder="Es. 7 caratteri alfanumerici"
                  maxLength={7}
                />
                <small className="form-text text-muted">Codice a 7 caratteri per la trasmissione via SDI</small>
              </div>
              <div className="col-md-6">
                <label className="form-label">PEC (Posta Elettronica Certificata)</label>
                <input
                  type="email"
                  className="form-control"
                  value={formData.pec}
                  onChange={(e) => setFormData((prev) => ({ ...prev, pec: e.target.value }))}
                  placeholder="esempio@pec.it"
                />
                <small className="form-text text-muted">Indirizzo PEC per ricevere fatture elettroniche</small>
              </div>
              <div className="col-md-6">
                <label className="form-label">Tipo Documento Predefinito</label>
                <select
                  className="form-select"
                  value={formData.tipo_documento_predefinito}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tipo_documento_predefinito: e.target.value }))}
                >
                  <option value="">Seleziona...</option>
                  {TIPI_DOCUMENTO.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">Regime Fiscale e Dati Aziendali</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Regime Fiscale</label>
                <select
                  className="form-select"
                  value={formData.regime_fiscale}
                  onChange={(e) => setFormData((prev) => ({ ...prev, regime_fiscale: e.target.value }))}
                >
                  <option value="">Seleziona...</option>
                  {REGIMI_FISCALI.map((regime) => (
                    <option key={regime} value={regime}>
                      {regime}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Codice ATECO</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.codice_ateco}
                  onChange={(e) => setFormData((prev) => ({ ...prev, codice_ateco: e.target.value }))}
                  placeholder="Es. 71.12.10"
                  maxLength={10}
                />
                <small className="form-text text-muted">Codice attività economica</small>
              </div>
              <div className="col-md-4">
                <label className="form-label">Numero REA</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.numero_rea}
                  onChange={(e) => setFormData((prev) => ({ ...prev, numero_rea: e.target.value }))}
                  placeholder="Es. 123456"
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Provincia REA</label>
                <select
                  className="form-select"
                  value={formData.provincia_rea}
                  onChange={(e) => setFormData((prev) => ({ ...prev, provincia_rea: e.target.value }))}
                >
                  <option value="">Seleziona...</option>
                  {PROVINCE_ITALIA.map((prov) => (
                    <option key={prov} value={prov}>
                      {prov}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Ufficio IVA</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.ufficio_iva}
                  onChange={(e) => setFormData((prev) => ({ ...prev, ufficio_iva: e.target.value }))}
                  placeholder="Es. Ufficio IVA di..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">Dati Bancari</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">IBAN</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.iban}
                  onChange={(e) => setFormData((prev) => ({ ...prev, iban: e.target.value.toUpperCase() }))}
                  placeholder="IT60 X054 2811 1010 0000 0123 456"
                  maxLength={34}
                />
                <small className="form-text text-muted">Codice IBAN per pagamenti</small>
              </div>
              <div className="col-md-6">
                <label className="form-label">Banca</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.banca}
                  onChange={(e) => setFormData((prev) => ({ ...prev, banca: e.target.value }))}
                  placeholder="Nome della banca"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">Ritenute e Contributi</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Ritenuta d'Acconto (%)</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.ritenuta_acconto}
                  onChange={(e) => {
                    const value = e.target.value.replace(',', '.')
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setFormData((prev) => ({ ...prev, ritenuta_acconto: value }))
                    }
                  }}
                  inputMode="decimal"
                  placeholder="0.00"
                />
                <small className="form-text text-muted">Percentuale ritenuta d'acconto</small>
              </div>
              <div className="col-md-4">
                <label className="form-label">Rivalsa INPS (%)</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.rivalsa_inps}
                  onChange={(e) => {
                    const value = e.target.value.replace(',', '.')
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setFormData((prev) => ({ ...prev, rivalsa_inps: value }))
                    }
                  }}
                  inputMode="decimal"
                  placeholder="0.00"
                />
                <small className="form-text text-muted">Percentuale rivalsa INPS</small>
              </div>
              <div className="col-md-4">
                <label className="form-label">Cassa Previdenziale</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.cassa_previdenziale}
                  onChange={(e) => setFormData((prev) => ({ ...prev, cassa_previdenziale: e.target.value }))}
                  placeholder="Es. ENPAM, CNI, ecc."
                />
                <small className="form-text text-muted">Nome della cassa previdenziale</small>
              </div>
            </div>
          </div>
        </div>

        <div className="actions-sticky d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default DatiFiscali
