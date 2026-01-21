const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const Logger = require('../utils/loggerWinston');
const Validators = require('../utils/validators');
const ErrorHandler = require('../utils/errorHandler');
const { validateRequest } = require('../utils/validationMiddleware');
const ValidationSchemas = require('../utils/validationSchemas');
const Pagination = require('../utils/pagination');
const cache = require('../utils/cache');

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
      // Contatti
      getContatti: this.db.prepare('SELECT * FROM clienti_contatti WHERE cliente_id = ? ORDER BY nome ASC'),
      getContattoById: this.db.prepare('SELECT * FROM clienti_contatti WHERE id = ? AND cliente_id = ?'),
      createContatto: this.db.prepare(`
        INSERT INTO clienti_contatti (cliente_id, nome, ruolo, telefono, email)
        VALUES (?, ?, ?, ?, ?)
      `),
      updateContatto: this.db.prepare(`
        UPDATE clienti_contatti SET
          nome = ?, ruolo = ?, telefono = ?, email = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ? AND cliente_id = ?
      `),
      deleteContatto: this.db.prepare('DELETE FROM clienti_contatti WHERE id = ? AND cliente_id = ?')
    };
  }

  getAll(req, res) {
    try {
      const { search } = req.query;
      const { page, limit, offset } = Pagination.getParams(req, 50, 100);
      
      let clienti;
      let total;
      
      if (search) {
        const searchTerm = `%${search}%`;
        // Per la ricerca, otteniamo tutti i risultati e li paginiamo manualmente
        // perché la query di ricerca è più complessa
        const allResults = this.stmt.search.all(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        total = allResults.length;
        clienti = allResults.slice(offset, offset + limit);
      } else {
        // Conta totale senza paginazione
        const allResults = this.stmt.getAll.all();
        total = allResults.length;
        // Applica paginazione manualmente (SQLite non supporta COUNT(*) OVER facilmente)
        clienti = allResults.slice(offset, offset + limit);
      }

      Logger.info('GET /clienti', { count: clienti.length, total, page, limit, search });
      
      // Se non c'è ricerca, restituisci dati paginati
      if (!search && (page > 1 || limit < total)) {
        res.json(Pagination.createResponse(clienti, total, page, limit));
      } else {
        // Per retrocompatibilità, se non ci sono parametri di paginazione o c'è ricerca, restituisci array semplice
        if (!req.query.page && !req.query.limit) {
          res.json(clienti);
        } else {
          res.json(Pagination.createResponse(clienti, total, page, limit));
        }
      }
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

      const contatti = this.stmt.getContatti.all(id);
      cliente.contatti = contatti;

      Logger.info(`GET /clienti/${id}`);
      res.json(cliente);
    } catch (error) {
      Logger.error(`Errore GET /clienti/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  create(req, res) {
    try {
      // Sanitizza input
      const body = Validators.sanitizeObject(req.body);
      const {
        denominazione, paese, 
        codiceDestinatarioSDI, codice_destinatario_sdi,
        indirizzo, comune, cap, provincia, 
        partitaIva, partita_iva,
        codiceFiscale, codice_fiscale
      } = body;

      // Validazione
      if (!denominazione || denominazione.trim().length === 0) {
        throw ErrorHandler.createError('Denominazione obbligatoria', 400);
      }

      if (denominazione.length > 255) {
        throw ErrorHandler.createError('Denominazione troppo lunga (max 255 caratteri)', 400);
      }

      // Valida P.IVA se fornita
      const piva = partitaIva || partita_iva;
      if (piva && !Validators.isValidPartitaIva(piva)) {
        throw ErrorHandler.createError('Partita IVA non valida', 400);
      }

      // Valida Codice Fiscale se fornito
      const cf = codiceFiscale || codice_fiscale;
      if (cf && !Validators.isValidCodiceFiscale(cf)) {
        throw ErrorHandler.createError('Codice Fiscale non valido', 400);
      }

      // Valida CAP se fornito
      if (cap && !Validators.isValidCap(cap)) {
        throw ErrorHandler.createError('CAP non valido (deve essere di 5 cifre)', 400);
      }

      const result = this.stmt.create.run(
        Validators.sanitizeString(denominazione), 
        paese ? Validators.sanitizeString(paese) : null, 
        (codiceDestinatarioSDI || codice_destinatario_sdi) ? Validators.sanitizeString(codiceDestinatarioSDI || codice_destinatario_sdi) : null,
        indirizzo ? Validators.sanitizeString(indirizzo) : null, 
        comune ? Validators.sanitizeString(comune) : null, 
        cap || null,
        provincia ? Validators.sanitizeString(provincia) : null, 
        piva || null, 
        cf || null
      );

      Logger.info('POST /clienti', { id: result.lastInsertRowid });
      res.status(201).json({ id: result.lastInsertRowid, ...body });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
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

  // Contatti API
  getContatti(req, res) {
    try {
      const { id } = req.params;
      const contatti = this.stmt.getContatti.all(id);

      Logger.info(`GET /clienti/${id}/contatti`);
      res.json(contatti);
    } catch (error) {
      Logger.error(`Errore GET /clienti/${req.params.id}/contatti`, error);
      res.status(500).json({ error: error.message });
    }
  }

  createContatto(req, res) {
    try {
      const { id } = req.params;
      
      // Valida ID
      if (!Validators.isValidId(id)) {
        throw ErrorHandler.createError('ID cliente non valido', 400);
      }

      // Sanitizza input
      const body = Validators.sanitizeObject(req.body);
      const { nome, ruolo, telefono, email } = body;

      // Verifica che il cliente esista
      const cliente = this.stmt.getById.get(id);
      if (!cliente) {
        throw ErrorHandler.createError('Cliente non trovato', 404);
      }

      // Valida email se fornita
      if (email && !Validators.isValidEmail(email)) {
        throw ErrorHandler.createError('Email non valida', 400);
      }

      // Valida telefono se fornito
      if (telefono && !Validators.isValidPhone(telefono)) {
        throw ErrorHandler.createError('Telefono non valido', 400);
      }

      const result = this.stmt.createContatto.run(
        id,
        nome ? Validators.sanitizeString(nome) : null,
        ruolo ? Validators.sanitizeString(ruolo) : null,
        telefono || null,
        email || null
      );

      const contatto = this.stmt.getContattoById.get(result.lastInsertRowid, id);
      Logger.info(`POST /clienti/${id}/contatti`, { contattoId: result.lastInsertRowid });
      res.status(201).json(contatto);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      Logger.error(`Errore POST /clienti/${req.params.id}/contatti`, error);
      res.status(500).json({ error: error.message });
    }
  }

  updateContatto(req, res) {
    try {
      const { id, contattoId } = req.params;
      const { nome, ruolo, telefono, email } = req.body;

      // Verifica che il cliente esista
      const cliente = this.stmt.getById.get(id);
      if (!cliente) {
        return res.status(404).json({ error: 'Cliente non trovato' });
      }

      // Verifica che il contatto esista
      const existing = this.stmt.getContattoById.get(contattoId, id);
      if (!existing) {
        return res.status(404).json({ error: 'Contatto non trovato' });
      }

      const result = this.stmt.updateContatto.run(
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

      const updated = this.stmt.getContattoById.get(contattoId, id);
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

      const result = this.stmt.deleteContatto.run(contattoId, id);

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

  // Routes con validazione
  router.get('/', validateRequest(ValidationSchemas.pagination), (req, res) => controller.getAll(req, res));
  router.get('/:id', validateRequest(ValidationSchemas.id), (req, res) => controller.getById(req, res));
  router.post('/', validateRequest(ValidationSchemas.cliente.create), (req, res) => controller.create(req, res));
  router.put('/:id', validateRequest(ValidationSchemas.cliente.update), (req, res) => controller.update(req, res));
  router.delete('/:id', validateRequest(ValidationSchemas.id), (req, res) => controller.delete(req, res));

  // Contatti routes con validazione
  router.get('/:id/contatti', validateRequest(ValidationSchemas.id), (req, res) => controller.getContatti(req, res));
  router.post('/:id/contatti', validateRequest(ValidationSchemas.contatto.create), (req, res) => controller.createContatto(req, res));
  router.put('/:id/contatti/:contattoId', validateRequest(ValidationSchemas.contatto.update), (req, res) => controller.updateContatto(req, res));
  router.delete('/:id/contatti/:contattoId', validateRequest([...ValidationSchemas.id, param('contattoId').isInt({ min: 1 })]), (req, res) => controller.deleteContatto(req, res));

  return router;
}

module.exports = createRouter;

