const express = require('express');
const router = express.Router();
const Logger = require('../utils/loggerWinston');
const { validateRequest } = require('../utils/validationMiddleware');
const ValidationSchemas = require('../utils/validationSchemas');

class KanbanController {
  constructor(db) {
    this.db = db;
    this.initStatements();
  }

  initStatements() {
    this.stmt = {
      // Colonne
      getAllColonne: this.db.prepare('SELECT * FROM kanban_colonne ORDER BY ordine ASC'),
      getColonnaById: this.db.prepare('SELECT * FROM kanban_colonne WHERE id = ?'),
      createColonna: this.db.prepare(`
        INSERT INTO kanban_colonne (nome, ordine, colore, is_default)
        VALUES (?, ?, ?, ?)
      `),
      updateColonna: this.db.prepare(`
        UPDATE kanban_colonne SET
          nome = ?, ordine = ?, colore = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `),
      deleteColonna: this.db.prepare('DELETE FROM kanban_colonne WHERE id = ?'),
      
      // Card
      getAllCard: this.db.prepare(`
        SELECT kc.*, 
               kcol.nome as colonna_nome,
               kcol.colore as colonna_colore,
               u.username as responsabile_username,
               u.nome as responsabile_nome,
               u.cognome as responsabile_cognome
        FROM kanban_card kc
        LEFT JOIN kanban_colonne kcol ON kc.colonna_id = kcol.id
        LEFT JOIN utenti u ON kc.responsabile_id = u.id
        ORDER BY kc.colonna_id ASC, kc.ordine ASC
      `),
      getCardByColonna: this.db.prepare(`
        SELECT kc.*, 
               kcol.nome as colonna_nome,
               kcol.colore as colonna_colore,
               u.username as responsabile_username,
               u.nome as responsabile_nome,
               u.cognome as responsabile_cognome
        FROM kanban_card kc
        LEFT JOIN kanban_colonne kcol ON kc.colonna_id = kcol.id
        LEFT JOIN utenti u ON kc.responsabile_id = u.id
        WHERE kc.colonna_id = ?
        ORDER BY kc.ordine ASC
      `),
      getCardById: this.db.prepare(`
        SELECT kc.*, 
               kcol.nome as colonna_nome,
               kcol.colore as colonna_colore,
               u.username as responsabile_username,
               u.nome as responsabile_nome,
               u.cognome as responsabile_cognome
        FROM kanban_card kc
        LEFT JOIN kanban_colonne kcol ON kc.colonna_id = kcol.id
        LEFT JOIN utenti u ON kc.responsabile_id = u.id
        WHERE kc.id = ?
      `),
      createCard: this.db.prepare(`
        INSERT INTO kanban_card (
          commessa_id, titolo, descrizione, colonna_id, priorita,
          responsabile_id, cliente_id, cliente_nome, ordine,
          avanzamento, data_inizio, data_fine_prevista, data_fine_effettiva, budget, tags, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      updateCard: this.db.prepare(`
        UPDATE kanban_card SET
          commessa_id = ?, titolo = ?, descrizione = ?, colonna_id = ?,
          priorita = ?, responsabile_id = ?, cliente_id = ?, cliente_nome = ?,
          ordine = ?, avanzamento = ?, data_inizio = ?, data_fine_prevista = ?,
          data_fine_effettiva = ?, budget = ?, tags = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `),
      moveCard: this.db.prepare(`
        UPDATE kanban_card SET
          colonna_id = ?, ordine = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `),
      reorderCard: this.db.prepare(`
        UPDATE kanban_card SET
          ordine = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `),
      deleteCard: this.db.prepare('DELETE FROM kanban_card WHERE id = ?'),
      
      // Scadenze
      getScadenzeByCard: this.db.prepare(`
        SELECT * FROM kanban_scadenze
        WHERE card_id = ?
        ORDER BY data_scadenza ASC
      `),
      getScadenzaById: this.db.prepare('SELECT * FROM kanban_scadenze WHERE id = ?'),
      createScadenza: this.db.prepare(`
        INSERT INTO kanban_scadenze (card_id, titolo, descrizione, data_scadenza, tipo, priorita)
        VALUES (?, ?, ?, ?, ?, ?)
      `),
      updateScadenza: this.db.prepare(`
        UPDATE kanban_scadenze SET
          titolo = ?, descrizione = ?, data_scadenza = ?, tipo = ?, priorita = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `),
      completeScadenza: this.db.prepare(`
        UPDATE kanban_scadenze SET
          completata = 1,
          data_completamento = datetime('now', 'localtime'),
          completata_da = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `),
      deleteScadenza: this.db.prepare('DELETE FROM kanban_scadenze WHERE id = ?'),
      
      // Notifiche
      getNotificheByUser: this.db.prepare(`
        SELECT * FROM kanban_notifiche
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 100
      `),
      getNotificheUnreadByUser: this.db.prepare(`
        SELECT * FROM kanban_notifiche
        WHERE user_id = ? AND letto = 0
        ORDER BY created_at DESC
      `),
      getUnreadCount: this.db.prepare(`
        SELECT COUNT(*) as count FROM kanban_notifiche
        WHERE user_id = ? AND letto = 0
      `),
      createNotifica: this.db.prepare(`
        INSERT INTO kanban_notifiche (user_id, tipo, titolo, messaggio, card_id, scadenza_id, link)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),
      markAsRead: this.db.prepare(`
        UPDATE kanban_notifiche SET
          letto = 1,
          data_lettura = datetime('now', 'localtime')
        WHERE id = ?
      `),
      markAllAsRead: this.db.prepare(`
        UPDATE kanban_notifiche SET
          letto = 1,
          data_lettura = datetime('now', 'localtime')
        WHERE user_id = ? AND letto = 0
      `),
      
      // Commenti
      getCommentiByCard: this.db.prepare(`
        SELECT kc.*, 
               u.username, u.nome, u.cognome
        FROM kanban_card_commenti kc
        LEFT JOIN utenti u ON kc.user_id = u.id
        WHERE kc.card_id = ?
        ORDER BY kc.created_at ASC
      `),
      getCommentoById: this.db.prepare(`
        SELECT kc.*, 
               u.username, u.nome, u.cognome
        FROM kanban_card_commenti kc
        LEFT JOIN utenti u ON kc.user_id = u.id
        WHERE kc.id = ?
      `),
      createCommento: this.db.prepare(`
        INSERT INTO kanban_card_commenti (card_id, user_id, commento)
        VALUES (?, ?, ?)
      `),
      updateCommento: this.db.prepare(`
        UPDATE kanban_card_commenti SET
          commento = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ? AND user_id = ?
      `),
      deleteCommento: this.db.prepare(`
        DELETE FROM kanban_card_commenti 
        WHERE id = ? AND user_id = ?
      `)
    };
  }

  // Helper per creare notifiche automatiche
  createNotificationForCard(cardId, tipo, titolo, messaggio, excludeUserId = null) {
    try {
      // Ottieni tutti gli utenti (o tutti tranne quello che ha fatto l'azione)
      let users;
      if (excludeUserId) {
        users = this.db.prepare('SELECT id FROM utenti WHERE id != ?').all(excludeUserId);
      } else {
        users = this.db.prepare('SELECT id FROM utenti').all();
      }
      
      const link = `/kanban?card=${cardId}`;
      users.forEach(user => {
        this.stmt.createNotifica.run(
          user.id,
          tipo,
          titolo,
          messaggio,
          cardId,
          null,
          link
        );
      });
    } catch (error) {
      Logger.error('Errore creazione notifica automatica', error);
    }
  }

  // ========== COLONNE ==========
  getAllColonne(req, res) {
    try {
      const colonne = this.stmt.getAllColonne.all();
      Logger.info('GET /kanban/colonne');
      res.json(colonne);
    } catch (error) {
      Logger.error('Errore GET /kanban/colonne', error);
      res.status(500).json({ error: error.message });
    }
  }

  getColonnaById(req, res) {
    try {
      const { id } = req.params;
      const colonna = this.stmt.getColonnaById.get(id);
      if (!colonna) {
        return res.status(404).json({ error: 'Colonna non trovata' });
      }
      Logger.info(`GET /kanban/colonne/${id}`);
      res.json(colonna);
    } catch (error) {
      Logger.error(`Errore GET /kanban/colonne/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  createColonna(req, res) {
    try {
      const { nome, ordine, colore, is_default } = req.body;
      if (!nome) {
        return res.status(400).json({ error: 'Nome colonna obbligatorio' });
      }
      const result = this.stmt.createColonna.run(
        nome,
        ordine || 0,
        colore || null,
        is_default ? 1 : 0
      );
      const created = this.stmt.getColonnaById.get(result.lastInsertRowid);
      Logger.info('POST /kanban/colonne', { id: result.lastInsertRowid });
      res.status(201).json(created);
    } catch (error) {
      Logger.error('Errore POST /kanban/colonne', error);
      res.status(500).json({ error: error.message });
    }
  }

  updateColonna(req, res) {
    try {
      const { id } = req.params;
      const { nome, ordine, colore } = req.body;
      if (!nome) {
        return res.status(400).json({ error: 'Nome colonna obbligatorio' });
      }
      const result = this.stmt.updateColonna.run(nome, ordine || 0, colore || null, id);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Colonna non trovata' });
      }
      const updated = this.stmt.getColonnaById.get(id);
      Logger.info(`PUT /kanban/colonne/${id}`);
      res.json(updated);
    } catch (error) {
      Logger.error(`Errore PUT /kanban/colonne/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  deleteColonna(req, res) {
    try {
      const { id } = req.params;
      // Verifica che non ci siano card nella colonna
      const cardCount = this.db.prepare('SELECT COUNT(*) as count FROM kanban_card WHERE colonna_id = ?').get(id);
      if (cardCount.count > 0) {
        return res.status(400).json({ error: 'Impossibile eliminare colonna con card associate' });
      }
      const result = this.stmt.deleteColonna.run(id);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Colonna non trovata' });
      }
      Logger.info(`DELETE /kanban/colonne/${id}`);
      res.json({ success: true });
    } catch (error) {
      Logger.error(`Errore DELETE /kanban/colonne/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  // ========== CARD ==========
  getAllCard(req, res) {
    try {
      const { 
        colonna_id, 
        cliente_id, 
        responsabile_id, 
        priorita, 
        ricerca,
        data_inizio_da,
        data_inizio_a,
        data_fine_da,
        data_fine_a,
        tags
      } = req.query;
      
      let card;
      if (colonna_id) {
        card = this.stmt.getCardByColonna.all(colonna_id);
      } else {
        card = this.stmt.getAllCard.all();
      }
      
      // Filtri aggiuntivi
      if (cliente_id) {
        card = card.filter(c => c.cliente_id == cliente_id);
      }
      if (responsabile_id) {
        card = card.filter(c => c.responsabile_id == responsabile_id);
      }
      if (priorita) {
        card = card.filter(c => c.priorita === priorita);
      }
      if (ricerca) {
        const searchLower = ricerca.toLowerCase();
        card = card.filter(c => 
          (c.titolo && c.titolo.toLowerCase().includes(searchLower)) ||
          (c.descrizione && c.descrizione.toLowerCase().includes(searchLower)) ||
          (c.cliente_nome && c.cliente_nome.toLowerCase().includes(searchLower))
        );
      }
      if (data_inizio_da) {
        card = card.filter(c => c.data_inizio && c.data_inizio >= data_inizio_da);
      }
      if (data_inizio_a) {
        card = card.filter(c => c.data_inizio && c.data_inizio <= data_inizio_a);
      }
      if (data_fine_da) {
        card = card.filter(c => c.data_fine_prevista && c.data_fine_prevista >= data_fine_da);
      }
      if (data_fine_a) {
        card = card.filter(c => c.data_fine_prevista && c.data_fine_prevista <= data_fine_a);
      }
      if (tags) {
        const tagArray = tags.split(',').map(t => t.trim());
        card = card.filter(c => {
          if (!c.tags) return false;
          const cardTags = typeof c.tags === 'string' ? JSON.parse(c.tags) : c.tags;
          return tagArray.some(tag => cardTags.includes(tag));
        });
      }
      
      Logger.info('GET /kanban/card', { count: card.length, filters: req.query });
      res.json(card);
    } catch (error) {
      Logger.error('Errore GET /kanban/card', error);
      res.status(500).json({ error: error.message });
    }
  }

  getCardById(req, res) {
    try {
      const { id } = req.params;
      const card = this.stmt.getCardById.get(id);
      if (!card) {
        return res.status(404).json({ error: 'Card non trovata' });
      }
      Logger.info(`GET /kanban/card/${id}`);
      res.json(card);
    } catch (error) {
      Logger.error(`Errore GET /kanban/card/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  createCard(req, res) {
    try {
      const {
        commessa_id, titolo, descrizione, colonna_id, priorita,
        responsabile_id, cliente_id, cliente_nome, ordine,
        avanzamento, data_inizio, data_fine_prevista, budget, tags
      } = req.body;
      
      if (!titolo) {
        return res.status(400).json({ error: 'Titolo card obbligatorio' });
      }
      if (!colonna_id) {
        return res.status(400).json({ error: 'Colonna obbligatoria' });
      }
      
      // Verifica che la colonna esista
      const colonna = this.stmt.getColonnaById.get(colonna_id);
      if (!colonna) {
        return res.status(400).json({ error: 'Colonna non valida' });
      }
      
      // Se ordine non specificato, metti alla fine
      let cardOrdine = ordine;
      if (cardOrdine === undefined || cardOrdine === null) {
        const maxOrdine = this.db.prepare('SELECT MAX(ordine) as max FROM kanban_card WHERE colonna_id = ?').get(colonna_id);
        cardOrdine = (maxOrdine.max || 0) + 1;
      }
      
      const tagsJson = tags ? JSON.stringify(tags) : null;
      const result = this.stmt.createCard.run(
        commessa_id || null,
        titolo,
        descrizione || null,
        colonna_id,
        priorita || 'media',
        responsabile_id || null,
        cliente_id || null,
        cliente_nome || null,
        cardOrdine,
        avanzamento || 0,
        data_inizio || null,
        data_fine_prevista || null,
        null, // data_fine_effettiva
        budget || 0,
        tagsJson,
        req.user?.id || null
      );
      
      const created = this.stmt.getCardById.get(result.lastInsertRowid);
      
      // Crea notifica per nuova card
      this.createNotificationForCard(
        result.lastInsertRowid,
        'card_creata',
        'Nuova card creata',
        `È stata creata una nuova card: "${titolo}"`,
        req.user?.id
      );
      
      Logger.info('POST /kanban/card', { id: result.lastInsertRowid });
      res.status(201).json(created);
    } catch (error) {
      Logger.error('Errore POST /kanban/card', error);
      res.status(500).json({ error: error.message });
    }
  }

  updateCard(req, res) {
    try {
      const { id } = req.params;
      const {
        commessa_id, titolo, descrizione, colonna_id, priorita,
        responsabile_id, cliente_id, cliente_nome, ordine,
        avanzamento, data_inizio, data_fine_prevista, data_fine_effettiva, budget, tags
      } = req.body;
      
      if (!titolo) {
        return res.status(400).json({ error: 'Titolo card obbligatorio' });
      }
      
      // Leggi la card prima dell'update per confrontare i valori
      const oldCard = this.stmt.getCardById.get(id);
      if (!oldCard) {
        return res.status(404).json({ error: 'Card non trovata' });
      }
      
      const tagsJson = tags ? JSON.stringify(tags) : null;
      const result = this.stmt.updateCard.run(
        commessa_id || null,
        titolo,
        descrizione || null,
        colonna_id || null,
        priorita || 'media',
        responsabile_id || null,
        cliente_id || null,
        cliente_nome || null,
        ordine || 0,
        avanzamento || 0,
        data_inizio || null,
        data_fine_prevista || null,
        data_fine_effettiva || null,
        budget || 0,
        tagsJson,
        id
      );
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Card non trovata' });
      }
      
      const updated = this.stmt.getCardById.get(id);
      
      // Crea notifica per modifica card (solo se colonna cambiata o priorità cambiata)
      if (oldCard.colonna_id != colonna_id || oldCard.priorita !== priorita) {
        const tipoNotifica = oldCard.colonna_id != colonna_id ? 'card_spostata' : 'card_modificata';
        const messaggio = oldCard.colonna_id != colonna_id 
          ? `La card "${titolo}" è stata spostata`
          : `La card "${titolo}" è stata modificata`;
        this.createNotificationForCard(id, tipoNotifica, 'Card modificata', messaggio, req.user?.id);
      }
      
      Logger.info(`PUT /kanban/card/${id}`);
      res.json(updated);
    } catch (error) {
      Logger.error(`Errore PUT /kanban/card/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  moveCard(req, res) {
    try {
      const { id } = req.params;
      const { colonna_id, ordine } = req.body;
      
      if (!colonna_id) {
        return res.status(400).json({ error: 'Colonna obbligatoria' });
      }
      
      // Verifica che la colonna esista
      const colonna = this.stmt.getColonnaById.get(colonna_id);
      if (!colonna) {
        return res.status(400).json({ error: 'Colonna non valida' });
      }
      
      const result = this.stmt.moveCard.run(colonna_id, ordine || 0, id);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Card non trovata' });
      }
      
      const updated = this.stmt.getCardById.get(id);
      
      // Crea notifica per spostamento card
      if (updated) {
        this.createNotificationForCard(
          id,
          'card_spostata',
          'Card spostata',
          `La card "${updated.titolo}" è stata spostata`,
          req.user?.id
        );
      }
      
      Logger.info(`PUT /kanban/card/${id}/move`);
      res.json(updated);
    } catch (error) {
      Logger.error(`Errore PUT /kanban/card/${req.params.id}/move`, error);
      res.status(500).json({ error: error.message });
    }
  }

  deleteCard(req, res) {
    try {
      const { id } = req.params;
      const result = this.stmt.deleteCard.run(id);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Card non trovata' });
      }
      Logger.info(`DELETE /kanban/card/${id}`);
      res.json({ success: true });
    } catch (error) {
      Logger.error(`Errore DELETE /kanban/card/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  // ========== SCADENZE ==========
  getScadenzeByCard(req, res) {
    try {
      const { cardId } = req.params;
      const scadenze = this.stmt.getScadenzeByCard.all(cardId);
      Logger.info(`GET /kanban/card/${cardId}/scadenze`);
      res.json(scadenze);
    } catch (error) {
      Logger.error(`Errore GET /kanban/card/${req.params.cardId}/scadenze`, error);
      res.status(500).json({ error: error.message });
    }
  }

  createScadenza(req, res) {
    try {
      const { cardId } = req.params;
      const { titolo, descrizione, data_scadenza, tipo, priorita } = req.body;
      
      // Validazione aggiuntiva server-side
      if (!titolo || typeof titolo !== 'string' || !titolo.trim()) {
        return res.status(400).json({ error: 'Titolo scadenza obbligatorio' });
      }
      
      if (titolo.trim().length > 255) {
        return res.status(400).json({ error: 'Titolo troppo lungo (max 255 caratteri)' });
      }
      
      if (!data_scadenza || typeof data_scadenza !== 'string') {
        return res.status(400).json({ error: 'Data scadenza obbligatoria' });
      }
      
      // Valida formato data
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      if (!dateRegex.test(data_scadenza) && !dateTimeRegex.test(data_scadenza)) {
        return res.status(400).json({ error: 'Formato data non valido (atteso: YYYY-MM-DD)' });
      }
      
      // Verifica che la data sia valida
      const date = new Date(data_scadenza);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: 'Data non valida' });
      }
      
      if (descrizione && typeof descrizione === 'string' && descrizione.length > 1000) {
        return res.status(400).json({ error: 'Descrizione troppo lunga (max 1000 caratteri)' });
      }
      
      if (tipo && typeof tipo === 'string' && tipo.length > 50) {
        return res.status(400).json({ error: 'Tipo troppo lungo (max 50 caratteri)' });
      }
      
      const validPriorita = ['bassa', 'media', 'alta', 'urgente'];
      const finalPriorita = priorita && validPriorita.includes(priorita) ? priorita : 'media';
      
      // Verifica che la card esista
      const card = this.stmt.getCardById.get(cardId);
      if (!card) {
        return res.status(404).json({ error: 'Card non trovata' });
      }
      
      const result = this.stmt.createScadenza.run(
        cardId,
        titolo.trim(),
        descrizione && descrizione.trim() ? descrizione.trim() : null,
        data_scadenza,
        tipo && tipo.trim() ? tipo.trim() : null,
        finalPriorita
      );
      
      const created = this.stmt.getScadenzaById.get(result.lastInsertRowid);
      
      // Crea notifica per nuova scadenza
      if (card) {
        this.createNotificationForCard(
          cardId,
          'scadenza_creata',
          'Nuova scadenza',
          `È stata aggiunta una nuova scadenza alla card "${card.titolo}": "${titolo.trim()}"`,
          req.user?.id
        );
      }
      
      Logger.info(`POST /kanban/card/${cardId}/scadenze`, { id: result.lastInsertRowid });
      res.status(201).json(created);
    } catch (error) {
      Logger.error(`Errore POST /kanban/card/${req.params.cardId}/scadenze`, error);
      res.status(500).json({ error: error.message || 'Errore interno del server' });
    }
  }

  updateScadenza(req, res) {
    try {
      const { id } = req.params;
      const { titolo, descrizione, data_scadenza, tipo, priorita } = req.body;
      
      // Validazione aggiuntiva server-side
      if (!titolo || typeof titolo !== 'string' || !titolo.trim()) {
        return res.status(400).json({ error: 'Titolo scadenza obbligatorio' });
      }
      
      if (titolo.trim().length > 255) {
        return res.status(400).json({ error: 'Titolo troppo lungo (max 255 caratteri)' });
      }
      
      if (!data_scadenza || typeof data_scadenza !== 'string') {
        return res.status(400).json({ error: 'Data scadenza obbligatoria' });
      }
      
      // Valida formato data
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      if (!dateRegex.test(data_scadenza) && !dateTimeRegex.test(data_scadenza)) {
        return res.status(400).json({ error: 'Formato data non valido (atteso: YYYY-MM-DD)' });
      }
      
      // Verifica che la data sia valida
      const date = new Date(data_scadenza);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: 'Data non valida' });
      }
      
      if (descrizione && typeof descrizione === 'string' && descrizione.length > 1000) {
        return res.status(400).json({ error: 'Descrizione troppo lunga (max 1000 caratteri)' });
      }
      
      if (tipo && typeof tipo === 'string' && tipo.length > 50) {
        return res.status(400).json({ error: 'Tipo troppo lungo (max 50 caratteri)' });
      }
      
      const validPriorita = ['bassa', 'media', 'alta', 'urgente'];
      const finalPriorita = priorita && validPriorita.includes(priorita) ? priorita : 'media';
      
      const result = this.stmt.updateScadenza.run(
        titolo.trim(),
        descrizione && descrizione.trim() ? descrizione.trim() : null,
        data_scadenza,
        tipo && tipo.trim() ? tipo.trim() : null,
        finalPriorita,
        id
      );
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Scadenza non trovata' });
      }
      
      const updated = this.stmt.getScadenzaById.get(id);
      Logger.info(`PUT /kanban/scadenze/${id}`);
      res.json(updated);
    } catch (error) {
      Logger.error(`Errore PUT /kanban/scadenze/${req.params.id}`, error);
      res.status(500).json({ error: error.message || 'Errore interno del server' });
    }
  }

  completeScadenza(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;
      
      const result = this.stmt.completeScadenza.run(userId, id);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Scadenza non trovata' });
      }
      
      const updated = this.stmt.getScadenzaById.get(id);
      Logger.info(`PUT /kanban/scadenze/${id}/complete`);
      res.json(updated);
    } catch (error) {
      Logger.error(`Errore PUT /kanban/scadenze/${req.params.id}/complete`, error);
      res.status(500).json({ error: error.message });
    }
  }

  deleteScadenza(req, res) {
    try {
      const { id } = req.params;
      const result = this.stmt.deleteScadenza.run(id);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Scadenza non trovata' });
      }
      Logger.info(`DELETE /kanban/scadenze/${id}`);
      res.json({ success: true });
    } catch (error) {
      Logger.error(`Errore DELETE /kanban/scadenze/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  // ========== COMMENTI ==========
  getCommentiByCard(req, res) {
    try {
      const { cardId } = req.params;
      const commenti = this.stmt.getCommentiByCard.all(cardId);
      Logger.info(`GET /kanban/card/${cardId}/commenti`);
      res.json(commenti);
    } catch (error) {
      Logger.error(`Errore GET /kanban/card/${req.params.cardId}/commenti`, error);
      res.status(500).json({ error: error.message });
    }
  }

  createCommento(req, res) {
    try {
      const { cardId } = req.params;
      const { commento } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }
      
      if (!commento || !commento.trim()) {
        return res.status(400).json({ error: 'Commento obbligatorio' });
      }
      
      const result = this.stmt.createCommento.run(cardId, userId, commento.trim());
      const created = this.stmt.getCommentoById.get(result.lastInsertRowid);
      
      // Crea notifica per nuovo commento
      const card = this.stmt.getCardById.get(cardId);
      if (card) {
        this.createNotificationForCard(
          cardId,
          'commento_aggiunto',
          'Nuovo commento',
          `È stato aggiunto un nuovo commento alla card "${card.titolo}"`,
          userId
        );
      }
      
      Logger.info(`POST /kanban/card/${cardId}/commenti`, { id: result.lastInsertRowid });
      res.status(201).json(created);
    } catch (error) {
      Logger.error(`Errore POST /kanban/card/${req.params.cardId}/commenti`, error);
      res.status(500).json({ error: error.message });
    }
  }

  updateCommento(req, res) {
    try {
      const { id } = req.params;
      const { commento } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }
      
      if (!commento || !commento.trim()) {
        return res.status(400).json({ error: 'Commento obbligatorio' });
      }
      
      const result = this.stmt.updateCommento.run(commento.trim(), id, userId);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Commento non trovato o non autorizzato' });
      }
      
      const updated = this.stmt.getCommentoById.get(id);
      Logger.info(`PUT /kanban/commenti/${id}`);
      res.json(updated);
    } catch (error) {
      Logger.error(`Errore PUT /kanban/commenti/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  deleteCommento(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }
      
      const result = this.stmt.deleteCommento.run(id, userId);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Commento non trovato o non autorizzato' });
      }
      
      Logger.info(`DELETE /kanban/commenti/${id}`);
      res.json({ success: true });
    } catch (error) {
      Logger.error(`Errore DELETE /kanban/commenti/${req.params.id}`, error);
      res.status(500).json({ error: error.message });
    }
  }

  // ========== NOTIFICHE ==========
  getNotifiche(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }
      
      const { unread } = req.query;
      let notifiche;
      if (unread === 'true') {
        notifiche = this.stmt.getNotificheUnreadByUser.all(userId);
      } else {
        notifiche = this.stmt.getNotificheByUser.all(userId);
      }
      
      Logger.info('GET /kanban/notifiche', { userId, count: notifiche.length });
      res.json(notifiche);
    } catch (error) {
      Logger.error('Errore GET /kanban/notifiche', error);
      res.status(500).json({ error: error.message });
    }
  }

  getUnreadCount(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }
      
      const result = this.stmt.getUnreadCount.get(userId);
      Logger.info('GET /kanban/notifiche/unread-count', { userId, count: result.count });
      res.json({ count: result.count });
    } catch (error) {
      Logger.error('Errore GET /kanban/notifiche/unread-count', error);
      res.status(500).json({ error: error.message });
    }
  }

  markAsRead(req, res) {
    try {
      const { id } = req.params;
      const result = this.stmt.markAsRead.run(id);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Notifica non trovata' });
      }
      Logger.info(`PUT /kanban/notifiche/${id}/read`);
      res.json({ success: true });
    } catch (error) {
      Logger.error(`Errore PUT /kanban/notifiche/${req.params.id}/read`, error);
      res.status(500).json({ error: error.message });
    }
  }

  markAllAsRead(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Utente non autenticato' });
      }
      
      this.stmt.markAllAsRead.run(userId);
      Logger.info('PUT /kanban/notifiche/read-all', { userId });
      res.json({ success: true });
    } catch (error) {
      Logger.error('Errore PUT /kanban/notifiche/read-all', error);
      res.status(500).json({ error: error.message });
    }
  }
}

function createRouter(db) {
  const controller = new KanbanController(db);

  // Colonne
  router.get('/colonne', (req, res) => controller.getAllColonne(req, res));
  router.get('/colonne/:id', validateRequest(ValidationSchemas.id), (req, res) => controller.getColonnaById(req, res));
  router.post('/colonne', validateRequest(ValidationSchemas.kanban.colonna.create), (req, res) => controller.createColonna(req, res));
  router.put('/colonne/:id', validateRequest(ValidationSchemas.kanban.colonna.update), (req, res) => controller.updateColonna(req, res));
  router.delete('/colonne/:id', validateRequest(ValidationSchemas.id), (req, res) => controller.deleteColonna(req, res));

  // Card
  router.get('/card', (req, res) => controller.getAllCard(req, res));
  router.get('/card/:id', validateRequest(ValidationSchemas.id), (req, res) => controller.getCardById(req, res));
  router.post('/card', validateRequest(ValidationSchemas.kanban.card.create), (req, res) => controller.createCard(req, res));
  router.put('/card/:id', validateRequest(ValidationSchemas.kanban.card.update), (req, res) => controller.updateCard(req, res));
  router.put('/card/:id/move', validateRequest(ValidationSchemas.kanban.card.move), (req, res) => controller.moveCard(req, res));
  router.delete('/card/:id', validateRequest(ValidationSchemas.id), (req, res) => controller.deleteCard(req, res));
  
  // Commenti
  router.get('/card/:cardId/commenti', validateRequest(ValidationSchemas.idParam('cardId')), (req, res) => controller.getCommentiByCard(req, res));
  router.post('/card/:cardId/commenti', validateRequest(ValidationSchemas.kanban.commento.create), (req, res) => controller.createCommento(req, res));
  router.put('/commenti/:id', validateRequest(ValidationSchemas.kanban.commento.update), (req, res) => controller.updateCommento(req, res));
  router.delete('/commenti/:id', validateRequest(ValidationSchemas.id), (req, res) => controller.deleteCommento(req, res));

  // Scadenze
  router.get('/card/:cardId/scadenze', validateRequest(ValidationSchemas.idParam('cardId')), (req, res) => controller.getScadenzeByCard(req, res));
  router.post('/card/:cardId/scadenze', validateRequest(ValidationSchemas.kanban.scadenza.create), (req, res) => controller.createScadenza(req, res));
  router.put('/scadenze/:id', validateRequest(ValidationSchemas.kanban.scadenza.update), (req, res) => controller.updateScadenza(req, res));
  router.put('/scadenze/:id/complete', validateRequest(ValidationSchemas.id), (req, res) => controller.completeScadenza(req, res));
  router.delete('/scadenze/:id', validateRequest(ValidationSchemas.id), (req, res) => controller.deleteScadenza(req, res));

  // Notifiche
  router.get('/notifiche', (req, res) => controller.getNotifiche(req, res));
  router.get('/notifiche/unread-count', (req, res) => controller.getUnreadCount(req, res));
  router.put('/notifiche/:id/read', validateRequest(ValidationSchemas.id), (req, res) => controller.markAsRead(req, res));
  router.put('/notifiche/read-all', (req, res) => controller.markAllAsRead(req, res));

  return router;
}

module.exports = createRouter;

