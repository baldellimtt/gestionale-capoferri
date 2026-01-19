const express = require('express');

class ImpostazioniController {
  constructor(db) {
    this.db = db;
    this.initStatements();
  }

  initStatements() {
    this.stmt = {
      getDatiAziendali: this.db.prepare('SELECT * FROM dati_aziendali WHERE id = 1'),
      updateDatiAziendali: this.db.prepare(`
        UPDATE dati_aziendali SET
          ragione_sociale = ?,
          partita_iva = ?,
          codice_fiscale = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = 1
      `),
      getDatiFiscali: this.db.prepare('SELECT * FROM dati_fiscali WHERE id = 1'),
      updateDatiFiscali: this.db.prepare(`
        UPDATE dati_fiscali SET
          codice_destinatario_sdi = ?,
          pec = ?,
          regime_fiscale = ?,
          codice_ateco = ?,
          numero_rea = ?,
          provincia_rea = ?,
          ufficio_iva = ?,
          iban = ?,
          banca = ?,
          tipo_documento_predefinito = ?,
          ritenuta_acconto = ?,
          rivalsa_inps = ?,
          cassa_previdenziale = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = 1
      `)
    };
  }

  getDatiAziendali(req, res) {
    try {
      const dati = this.stmt.getDatiAziendali.get();
      if (!dati) {
        return res.status(404).json({ error: 'Dati aziendali non trovati' });
      }
      res.json(dati);
    } catch (err) {
      console.error('Errore recupero dati aziendali:', err);
      res.status(500).json({ error: 'Errore nel recupero dei dati aziendali' });
    }
  }

  updateDatiAziendali(req, res) {
    try {
      const { ragione_sociale, partita_iva, codice_fiscale } = req.body;

      this.stmt.updateDatiAziendali.run(
        ragione_sociale || '',
        partita_iva || '',
        codice_fiscale || ''
      );

      const updated = this.stmt.getDatiAziendali.get();
      res.json(updated);
    } catch (err) {
      console.error('Errore aggiornamento dati aziendali:', err);
      res.status(500).json({ error: 'Errore nell\'aggiornamento dei dati aziendali' });
    }
  }

  getDatiFiscali(req, res) {
    try {
      const dati = this.stmt.getDatiFiscali.get();
      if (!dati) {
        return res.status(404).json({ error: 'Dati fiscali non trovati' });
      }
      res.json(dati);
    } catch (err) {
      console.error('Errore recupero dati fiscali:', err);
      res.status(500).json({ error: 'Errore nel recupero dei dati fiscali' });
    }
  }

  updateDatiFiscali(req, res) {
    try {
      const {
        codice_destinatario_sdi,
        pec,
        regime_fiscale,
        codice_ateco,
        numero_rea,
        provincia_rea,
        ufficio_iva,
        iban,
        banca,
        tipo_documento_predefinito,
        ritenuta_acconto,
        rivalsa_inps,
        cassa_previdenziale
      } = req.body;

      const ritenuta = Number(String(ritenuta_acconto || 0).replace(',', '.'));
      const rivalsa = Number(String(rivalsa_inps || 0).replace(',', '.'));

      this.stmt.updateDatiFiscali.run(
        codice_destinatario_sdi || '',
        pec || '',
        regime_fiscale || '',
        codice_ateco || '',
        numero_rea || '',
        provincia_rea || '',
        ufficio_iva || '',
        iban || '',
        banca || '',
        tipo_documento_predefinito || '',
        isNaN(ritenuta) ? 0 : ritenuta,
        isNaN(rivalsa) ? 0 : rivalsa,
        cassa_previdenziale || ''
      );

      const updated = this.stmt.getDatiFiscali.get();
      res.json(updated);
    } catch (err) {
      console.error('Errore aggiornamento dati fiscali:', err);
      res.status(500).json({ error: 'Errore nell\'aggiornamento dei dati fiscali' });
    }
  }
}

function createRouter(db) {
  const router = express.Router();
  const controller = new ImpostazioniController(db);

  router.get('/dati-aziendali', controller.getDatiAziendali.bind(controller));
  router.put('/dati-aziendali', controller.updateDatiAziendali.bind(controller));
  router.get('/dati-fiscali', controller.getDatiFiscali.bind(controller));
  router.put('/dati-fiscali', controller.updateDatiFiscali.bind(controller));

  return router;
}

module.exports = createRouter;

