import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import api from '../services/api'
import { formatDateEuropean, getIsoDate } from '../utils/date'

const CATEGORIE = [
  'Trasferta',
  'Vitto',
  'Alloggio',
  'Carburante',
  'Materiali',
  'Altro'
]

const METODI = ['Carta aziendale', 'Carta personale', 'Contanti', 'Bonifico']

const STATI = ['Bozza', 'Inviata', 'Approvata', 'Rimborsata']

const createEmptyVoce = () => ({
  data: '',
  categoria: 'Trasferta',
  descrizione: '',
  importo: '',
  metodo: 'Carta aziendale',
  rimborsabile: true,
  allegato: null
})

function NoteSpese({ selectedMember, currentUser, toast, openKey }) {
  const [voci, setVoci] = useState([])
  const [formData, setFormData] = useState(createEmptyVoce())
  const [showSection, setShowSection] = useState(true)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [filters, setFilters] = useState({ stato: '', categoria: '' })
  const [filterType, setFilterType] = useState('none')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const canManageOthers = currentUser?.role === 'admin'
  const effectiveUserId = selectedMember?.id || currentUser?.id || null
  const reportUser = selectedMember || currentUser || {}

  useEffect(() => {
    if (openKey == null) return
    setShowSection(true)
  }, [openKey])

  const dateRange = useMemo(() => {
    if (filterType === 'mese') {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { startDate: getIsoDate(start), endDate: getIsoDate(end) }
    }
    if (filterType === 'trimestre') {
      const now = new Date()
      const quarter = Math.floor(now.getMonth() / 3)
      const start = new Date(now.getFullYear(), quarter * 3, 1)
      const end = new Date(now.getFullYear(), quarter * 3 + 3, 0)
      return { startDate: getIsoDate(start), endDate: getIsoDate(end) }
    }
    if (filterType === 'custom' && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate }
    }
    return { startDate: '', endDate: '' }
  }, [filterType, customStartDate, customEndDate])

  const loadVoci = async () => {
    if (!effectiveUserId) return
    try {
      setLoading(true)
      setError(null)
      const { startDate, endDate } = dateRange
      const data = await api.getNoteSpese({
        userId: canManageOthers ? effectiveUserId : undefined,
        categoria: filters.categoria || undefined,
        stato: filters.stato || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      })
      setVoci(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Errore caricamento note spese:', err)
      setError('Errore nel caricamento delle note spese.')
      setVoci([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVoci()
  }, [effectiveUserId, filters.categoria, filters.stato, dateRange])

  const addVoce = async () => {
    setError(null)
    const importo = Number(String(formData.importo || '').replace(',', '.'))
    if (!formData.descrizione.trim() || !Number.isFinite(importo) || importo <= 0) {
      setError('Inserisci descrizione e importo valido.')
      return
    }
    if (!effectiveUserId) {
      setError('Utente non valido.')
      return
    }
    const payload = {
      userId: canManageOthers ? effectiveUserId : undefined,
      data: formData.data || null,
      categoria: formData.categoria,
      descrizione: formData.descrizione.trim(),
      importo,
      metodo_pagamento: formData.metodo,
      rimborsabile: formData.rimborsabile ? 1 : 0,
      stato: 'Bozza'
    }
    try {
      setSaving(true)
      const loadingToastId = toast?.showLoading('Salvataggio in corso...', 'Nuova voce spesa')
      const created = await api.createNotaSpesa(payload)
      if (formData.allegato) {
        await api.uploadNotaSpesaAllegato(created.id, formData.allegato)
      }
      await loadVoci()
      setFormData(createEmptyVoce())
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Voce spesa salvata', duration: 3000 })
      } else {
        toast?.showSuccess('Voce spesa salvata')
      }
    } catch (err) {
      console.error('Errore salvataggio nota spesa:', err)
      const errorMsg = err.message || 'Errore nel salvataggio della voce.'
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const removeVoce = async (id) => {
    if (!id) return
    try {
      setDeletingId(id)
      const loadingToastId = toast?.showLoading('Eliminazione in corso...', 'Elimina voce spesa')
      await api.deleteNotaSpesa(id)
      await loadVoci()
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Voce eliminata', duration: 3000 })
      } else {
        toast?.showSuccess('Voce eliminata')
      }
    } catch (err) {
      console.error('Errore eliminazione nota spesa:', err)
      const errorMsg = err.message || 'Errore nell\'eliminazione della voce.'
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore eliminazione')
    } finally {
      setDeletingId(null)
    }
  }

  const filteredVoci = useMemo(() => {
    const { startDate, endDate } = dateRange
    const hasDateFilter = startDate && endDate
    const start = hasDateFilter ? new Date(`${startDate}T00:00:00`) : null
    const end = hasDateFilter ? new Date(`${endDate}T23:59:59`) : null
    return voci.filter((voce) => {
      if (filters.categoria && voce.categoria !== filters.categoria) return false
      if (filters.stato && voce.stato !== filters.stato) return false
      if (hasDateFilter) {
        const voceDate = voce?.data ? new Date(voce.data) : null
        if (!voceDate || Number.isNaN(voceDate.getTime())) return false
        if (voceDate < start || voceDate > end) return false
      }
      return true
    })
  }, [voci, filters, dateRange])

  const totale = useMemo(() => {
    return filteredVoci.reduce((sum, voce) => sum + (Number(voce.importo) || 0), 0)
  }, [filteredVoci])

  const exportPDF = async () => {
    if (!filteredVoci.length) return

    const doc = new jsPDF()
    let headerX = 14
    const headerTextTopY = 14
    let logoBottomY = headerTextTopY

    try {
      const logoImg = new Image()
      logoImg.src = '/logo-studio-ingegneria-removebg-preview.png'

      await new Promise((resolve) => {
        logoImg.onload = () => {
          try {
            const maxW = 42
            const maxH = 22
            const ratio = logoImg.width && logoImg.height ? logoImg.width / logoImg.height : 1
            let w = maxW
            let h = w / ratio
            if (h > maxH) {
              h = maxH
              w = h * ratio
            }
            const logoX = 14
            const logoY = 12
            doc.addImage(logoImg, 'PNG', logoX, logoY, w, h)
            headerX = logoX
            logoBottomY = logoY + h
            resolve()
          } catch {
            resolve()
          }
        }
        logoImg.onerror = () => resolve()
      })
    } catch {
      // Continua anche se il logo non si carica
    }

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    doc.text('Via Piave 35, 25030 Adro (BS)', headerX, headerTextTopY + 10)
    doc.text('Tel: +39 030 7357263 | Email: info@studiocapoferri.eu', headerX, headerTextTopY + 16)
    doc.text('P.IVA: 04732710985', headerX, headerTextTopY + 22)

    const headerTextBottomY = headerTextTopY + 22
    const headerBottomY = Math.max(logoBottomY, headerTextBottomY)

    doc.setFontSize(14)
    doc.setTextColor(60, 60, 60)
    doc.setFont('helvetica', 'bold')
    const reportTitleY = headerBottomY + 12
    doc.text('Report Note spese', 14, reportTitleY)

    let periodLabel = 'Tutti'
    if (filterType === 'mese') {
      const now = new Date()
      periodLabel = `Mese corrente (${now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })})`
    } else if (filterType === 'trimestre') {
      const now = new Date()
      const quarter = Math.floor(now.getMonth() / 3) + 1
      periodLabel = `Trimestre ${quarter} ${now.getFullYear()}`
    } else if (filterType === 'custom' && dateRange.startDate && dateRange.endDate) {
      periodLabel = `${dateRange.startDate} - ${dateRange.endDate}`
    }

    const filterParts = [`Periodo: ${periodLabel}`]
    if (filters.categoria) filterParts.push(`Categoria: ${filters.categoria}`)
    if (filters.stato) filterParts.push(`Stato: ${filters.stato}`)
    const reportFilterText = filterParts.join(' | ')

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    const filterY = reportTitleY + 7
    doc.text(reportFilterText, 14, filterY)

    const dipendenteNome = [reportUser?.nome, reportUser?.cognome].filter(Boolean).join(' ').trim()
    const dipendenteLabel = dipendenteNome || reportUser?.username || ''
    const details = [dipendenteLabel ? `Dipendente: ${dipendenteLabel}` : null].filter(Boolean)
    if (details.length > 0) {
      doc.setFontSize(9)
      doc.setTextColor(90, 90, 90)
      details.forEach((line, idx) => {
        doc.text(line, 14, filterY + 6 + (idx * 5))
      })
    }

    const tableStartY = filterY + (details.length > 0 ? 6 + details.length * 5 + 3 : 6)
    const tableData = [...filteredVoci]
      .sort((a, b) => (a?.data || '').localeCompare(b?.data || ''))
      .map((voce) => {
        const dateFormatted = formatDateEuropean(voce.data)
        const metodo = voce.metodo_pagamento || voce.metodo || ''
        return [
          dateFormatted,
          voce.categoria || '',
          voce.descrizione || '',
          `EUR ${Number(voce.importo || 0).toFixed(2)}`,
          metodo,
          voce.stato || 'Bozza',
          voce.rimborsabile ? 'Si' : 'No'
        ]
      })

    tableData.push([
      { content: 'Totale', styles: { fontStyle: 'bold', halign: 'center' } },
      '',
      '',
      { content: `EUR ${totale.toFixed(2)}`, styles: { halign: 'center', fontStyle: 'bold' } },
      '',
      '',
      ''
    ])

    autoTable(doc, {
      head: [['Data', 'Categoria', 'Descrizione', 'Importo', 'Metodo', 'Stato', 'Rimborsabile']],
      body: tableData,
      startY: tableStartY,
      styles: {
        fontSize: 9,
        textColor: [33, 33, 33],
        halign: 'center'
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [42, 63, 84],
        fontStyle: 'bold'
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [33, 33, 33]
      }
    })

    const summaryStartY = (doc.lastAutoTable?.finalY || filterY + 6) + 10
    const pageHeight = doc.internal.pageSize.height
    let summaryY = summaryStartY
    if (summaryY > pageHeight - 30) {
      doc.addPage()
      summaryY = 20
    }

    const rimborsabiliCount = filteredVoci.filter((voce) => voce.rimborsabile).length
    doc.setFontSize(10)
    doc.setTextColor(42, 63, 84)
    doc.setFont('helvetica', 'bold')
    doc.text('Totale note spese', 14, summaryY)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(`Totale: EUR ${totale.toFixed(2)} | Voci: ${filteredVoci.length} | Rimborsabili: ${rimborsabiliCount}`, 14, summaryY + 6)

    const dataGenerazione = new Date().toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Generato il: ${dataGenerazione}`, 14, doc.internal.pageSize.height - 10)

    doc.save(`report-note-spese-${getIsoDate()}.pdf`)
  }

  if (!showSection) {
    return null
  }

  return (
    <div className="note-spese-section">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <h3 className="section-title mb-1 no-title-line">Note spese</h3>
        </div>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setShowSection(false)}
          >
            Chiudi
          </button>
        </div>
      </div>

      <div className="filters-section note-spese-filters">
        <label>Filtro Periodo:</label>
        <select
          className="form-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="none">Tutti</option>
          <option value="mese">Mese Corrente</option>
          <option value="trimestre">Trimestre Corrente</option>
          <option value="custom">Periodo Personalizzato</option>
        </select>

        {filterType === 'custom' && (
          <>
            <label>Da:</label>
            <input
              type="date"
              className="form-control"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              style={{ width: 'auto' }}
            />
            <label>A:</label>
            <input
              type="date"
              className="form-control"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              style={{ width: 'auto' }}
            />
          </>
        )}

        <label>Categoria:</label>
        <select
          className="form-select"
          value={filters.categoria}
          onChange={(e) => setFilters((prev) => ({ ...prev, categoria: e.target.value }))}
          style={{ width: 'auto' }}
        >
          <option value="">Tutte</option>
          {CATEGORIE.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <label>Stato:</label>
        <select
          className="form-select"
          value={filters.stato}
          onChange={(e) => setFilters((prev) => ({ ...prev, stato: e.target.value }))}
          style={{ width: 'auto' }}
        >
          <option value="">Tutti</option>
          {STATI.map((stato) => (
            <option key={stato} value={stato}>{stato}</option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          onClick={exportPDF}
          disabled={filteredVoci.length === 0}
        >
          Esporta PDF
        </button>
      </div>

      <div className="note-spese-layout">
        <div className="card note-spese-form-card">
          <div className="card-header">Nuova voce spesa</div>
          <div className="card-body">
            {error && <div className="alert alert-warning mb-3">{error}</div>}
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Data</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.data}
                  onChange={(e) => setFormData((prev) => ({ ...prev, data: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Categoria</label>
                <select
                  className="form-select"
                  value={formData.categoria}
                  onChange={(e) => setFormData((prev) => ({ ...prev, categoria: e.target.value }))}
                >
                  {CATEGORIE.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Metodo pagamento</label>
                <select
                  className="form-select"
                  value={formData.metodo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, metodo: e.target.value }))}
                >
                  {METODI.map((metodo) => (
                    <option key={metodo} value={metodo}>{metodo}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-8">
                <label className="form-label">Descrizione</label>
                <input
                  className="form-control"
                  value={formData.descrizione}
                  onChange={(e) => setFormData((prev) => ({ ...prev, descrizione: e.target.value }))}
                  placeholder="Dettagli spesa"
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Importo (EUR)</label>
                <input
                  className="form-control"
                  value={formData.importo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, importo: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Allegato</label>
                <input
                  type="file"
                  className="form-control"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setFormData((prev) => ({ ...prev, allegato: file }))
                  }}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">&nbsp;</label>
                <div className="d-flex align-items-center note-spese-check-row">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="rimborsabile"
                    checked={formData.rimborsabile}
                    onChange={(e) => setFormData((prev) => ({ ...prev, rimborsabile: e.target.checked }))}
                  />
                  <label className="form-check-label" htmlFor="rimborsabile">
                    Rimborsabile
                  </label>
                </div>
                </div>
              </div>
            </div>
            <div className="actions-sticky mt-4 d-flex gap-2">
              <button type="button" className="btn btn-primary" onClick={addVoce} disabled={saving}>
                {saving ? 'Salvataggio...' : 'Aggiungi voce'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setFormData(createEmptyVoce())
                  setError(null)
                }}
                disabled={saving}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
        <div className="card note-spese-summary-card">
          <div className="card-header">Riepilogo</div>
          <div className="card-body">
            <div className="note-spese-summary">
              <div className="note-spese-summary-item">
                <span className="note-spese-summary-label">Voci</span>
                <strong>{filteredVoci.length}</strong>
              </div>
              <div className="note-spese-summary-item">
                <span className="note-spese-summary-label">Totale</span>
                <strong>EUR {totale.toFixed(2)}</strong>
              </div>
              <div className="note-spese-summary-item">
                <span className="note-spese-summary-label">Rimborsabili</span>
                <strong>
                  {filteredVoci.filter((voce) => voce.rimborsabile).length}
                </strong>
              </div>
            </div>

            <div className="note-spese-table-wrapper mt-3">
              <table className="table table-striped note-spese-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Categoria</th>
                    <th>Descrizione</th>
                    <th>Importo</th>
                    <th>Stato</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVoci.map((voce) => (
                    <tr key={voce.id}>
                      <td>{voce.data || '-'}</td>
                      <td>{voce.categoria}</td>
                      <td>{voce.descrizione}</td>
                      <td>EUR {Number(voce.importo).toFixed(2)}</td>
                      <td>{voce.stato || 'Bozza'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => removeVoce(voce.id)}
                          disabled={deletingId === voce.id}
                        >
                          {deletingId === voce.id ? '...' : 'Elimina'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredVoci.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-muted">
                        {loading ? 'Caricamento...' : 'Nessuna voce presente. Usa il form per aggiungerne una.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NoteSpese
