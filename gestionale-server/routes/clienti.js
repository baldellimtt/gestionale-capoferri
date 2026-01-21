const express = require('express');
const router = express.Router();
const Logger = require('../utils/logger');
const { validateRequest } = require('../utils/validationMiddleware');
const ValidationSchemas = require('../utils/validationSchemas');

class ClientiController {
  constructor(db) {
    this.db = db;
    this.initStatements();
  }

  initStatements() {
    this.stmt = {
      getAll: this.db.prepare('SELECT * FROM clienti ORDER BY denominazione ASC'),
      getById: this.db.prepare('SELECT * FROM clienti WHERE id = ?'),
      create: this.db.prepare(`
        INSERT INTO clienti (
          denominazione, paese, codice_destinatario_sdi, indirizzo,
          comune, cap, provincia, partita_iva, codice_fiscale
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      update: this.db.prepare(`
        UPDATE clienti SET
          denominazione = ?, paese = ?, codice_destinatario_sdi = ?,
          indirizzo = ?, comune = ?, cap = ?, provincia = ?,
          partita_iva = ?, codice_fiscale = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `),
      delete: this.db.prepare('DELETE FROM clienti WHERE id = ?'),
      search: this.db.prepare(`
        SELECT * FROM clienti
        WHERE denominazione LIKE ? OR paese LIKE ? OR comune LIKE ?
           OR partita_iva LIKE ? OR codice_fiscale LIKE ?
        ORDER BY denominazione ASC
      `),
      contattiGetByCliente: this.db.prepare(`
        SELECT id, cliente_id, nome, ruolo, telefono, email, created_at, updated_at
        FROM clienti_contatti
        WHERE cliente_id = ?
        ORDER BY nome ASC, id ASC
      `),
      contattiCreate: this.db.prepare(`
        INSERT INTO clienti_contatti (cliente_id, nome, ruolo, telefono, email)
        VALUES (?, ?, ?, ?, ?)
      `),
      contattiUpdate: this.db.prepare(`
        UPDATE clienti_contatti SET
          nome = ?,
          ruolo = ?,
          telefono = ?,
          email = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ? AND cliente_id = ?
      `),
      contattiDelete: this.db.prepare(`
        DELETE FROM clienti_contatti
        WHERE id = ? AND cliente_id = ?
      `)
    };
  }

  getAll(req, res) {
    try {
      const { search } = req.query;
      
      let clienti;
      if (search) {
        const searchTerm = `%${search}%`;
        clienti = this.stmt.search.all(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      } else {
        clienti = this.stmt.getAll.all();
      }

      Logger.info('GET /clienti', { count: clienti.length, search });
      res.json(clienti);
    } catch (error) {
      Logger.error('Errore GET /clienti', error);
      res.status(500).json({ error: error.message });
    }
  }

  getById(req, res) {
    try {
      const { id } = req.params;
      const cliente = this.stmt.getById.get(id);

      if (!cliente) {
        return res.status(404).json({ error: 'Cliente non trovato' });
      }

      Logger.info(`GET /clienti/${id}`);
      res.json(cliente);
    } catch (error) {
      Logger.error(`Errore GET /clienti/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  create(req, res) {
    try {
      const {
        denominazione, paese, 
        codiceDestinatarioSDI, codice_destinatario_sdi,
        indirizzo, comune, cap, provincia, 
        partitaIva, partita_iva,
        codiceFiscale, codice_fiscale
      } = req.body;

      if (!denominazione) {
        return res.status(400).json({ error: 'Denominazione obbligatoria' });
      }

      const result = this.stmt.create.run(
        denominazione, 
        paese || null, 
        (codiceDestinatarioSDI || codice_destinatario_sdi) || null,
        indirizzo || null, 
        comune || null, 
        cap || null,
        provincia || null, 
        (partitaIva || partita_iva) || null, 
        (codiceFiscale || codice_fiscale) || null
      );

      Logger.info('POST /clienti', { id: result.lastInsertRowid });
      res.status(201).json({ id: result.lastInsertRowid, ...req.body });
    } catch (error) {
      Logger.error('Errore POST /clienti', error);
      res.status(500).json({ error: error.message });
    }
  }

  update(req, res) {
    try {
      const { id } = req.params;
      const {
        denominazione, paese, 
        codiceDestinatarioSDI, codice_destinatario_sdi,
        indirizzo, comune, cap, provincia, 
        partitaIva, partita_iva,
        codiceFiscale, codice_fiscale
      } = req.body;

      if (!denominazione) {
        return res.status(400).json({ error: 'Denominazione obbligatoria' });
      }

      const result = this.stmt.update.run(
        denominazione, 
        paese || null, 
        (codiceDestinatarioSDI || codice_destinatario_sdi) || null,
        indirizzo || null, 
        comune || null, 
        cap || null,
        provincia || null, 
        (partitaIva || partita_iva) || null, 
        (codiceFiscale || codice_fiscale) || null,
        id
      );

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Cliente non trovato' });
      }

      Logger.info(`PUT /clienti/${id}`);
      res.json({ id: parseInt(id), ...req.body });
    } catch (error) {
      Logger.error(`Errore PUT /clienti/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  delete(req, res) {
    try {
      const { id } = req.params;
      const result = this.stmt.delete.run(id);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Cliente non trovato' });
      }

      Logger.info(`DELETE /clienti/${id}`);
      res.json({ success: true });
    } catch (error) {
      Logger.error(`Errore DELETE /clienti/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  getContatti(req, res) {
    try {
      const { id } = req.params;
      const contatti = this.stmt.contattiGetByCliente.all(id);
      Logger.info(`GET /clienti/${id}/contatti`, { count: contatti.length });
      res.json(contatti);
    } catch (error) {
      Logger.error(`Errore GET /clienti/${req.params.id}/contatti`, error);
      res.status(500).json({ error: error.message });
    }
  }

  createContatto(req, res) {
    try {
      const { id } = req.params;
      const { nome, ruolo, telefono, email } = req.body || {};
      const result = this.stmt.contattiCreate.run(
        id,
        nome || null,
        ruolo || null,
        telefono || null,
        email || null
      );
      const created = this.db.prepare('SELECT * FROM clienti_contatti WHERE id = ?').get(result.lastInsertRowid);
      Logger.info(`POST /clienti/${id}/contatti`, { id: result.lastInsertRowid });
      res.status(201).json(created);
    } catch (error) {
      Logger.error(`Errore POST /clienti/${req.params.id}/contatti`, error);
      res.status(500).json({ error: error.message });
    }
  }

  updateContatto(req, res) {
    try {
      const { id, contattoId } = req.params;
      const { nome, ruolo, telefono, email } = req.body || {};
      const result = this.stmt.contattiUpdate.run(
        nome || null,
        ruolo || null,
        telefono || null,
        email || null,
        contattoId,
        id
      );
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Contatto non trovato' });
      }
      const updated = this.db.prepare('SELECT * FROM clienti_contatti WHERE id = ?').get(contattoId);
      Logger.info(`PUT /clienti/${id}/contatti/${contattoId}`);
      res.json(updated);
    } catch (error) {
      Logger.error(`Errore PUT /clienti/${req.params.id}/contatti/${req.params.contattoId}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  deleteContatto(req, res) {
    try {
      const { id, contattoId } = req.params;
      const result = this.stmt.contattiDelete.run(contattoId, id);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Contatto non trovato' });
      }
      Logger.info(`DELETE /clienti/${id}/contatti/${contattoId}`);
      res.json({ success: true });
    } catch (error) {
      Logger.error(`Errore DELETE /clienti/${req.params.id}/contatti/${req.params.contattoId}`, error);
      res.status(500).json({ error: error.message });
    }
  }
}

function createRouter(db) {
  const controller = new ClientiController(db);

  router.get('/', (req, res) => controller.getAll(req, res));
  router.get('/:id', (req, res) => controller.getById(req, res));
  router.post('/', (req, res) => controller.create(req, res));
  router.put('/:id', (req, res) => controller.update(req, res));
  router.delete('/:id', (req, res) => controller.delete(req, res));

  router.get('/:id/contatti', (req, res) => controller.getContatti(req, res));
  router.post('/:id/contatti', validateRequest(ValidationSchemas.contatto.create), (req, res) => controller.createContatto(req, res));
  router.put('/:id/contatti/:contattoId', validateRequest(ValidationSchemas.contatto.update), (req, res) => controller.updateContatto(req, res));
  router.delete('/:id/contatti/:contattoId', (req, res) => controller.deleteContatto(req, res));

  return router;
}

module.exports = createRouter;
