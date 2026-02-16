const express = require('express');
const crypto = require('crypto');
const Logger = require('../utils/loggerWinston');
const { hashPassword } = require('../utils/auth');

const router = express.Router();

const REQUEST_TYPES = new Set(['access', 'export', 'rectification', 'erasure', 'restriction', 'objection']);
const REQUEST_STATUS = new Set(['open', 'in_progress', 'waiting_input', 'done', 'rejected']);

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function parseId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function createRouter(db, privacyRetention = null) {
  const stmt = {
    privacyGetAll: db.prepare(`
      SELECT id, requester_type, requester_id, requester_label, request_type, status,
             opened_at, due_at, closed_at, notes, handled_by, payload_json, row_version,
             created_at, updated_at
      FROM privacy_requests
      ORDER BY datetime(created_at) DESC, id DESC
    `),
    privacyGetById: db.prepare('SELECT * FROM privacy_requests WHERE id = ?'),
    privacyCreate: db.prepare(`
      INSERT INTO privacy_requests (
        requester_type, requester_id, requester_label, request_type, status,
        opened_at, due_at, notes, handled_by, payload_json
      ) VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?, ?, ?)
    `),
    privacyUpdate: db.prepare(`
      UPDATE privacy_requests
      SET status = ?,
          due_at = ?,
          closed_at = ?,
          notes = ?,
          handled_by = ?,
          payload_json = ?,
          updated_at = datetime('now', 'localtime'),
          row_version = row_version + 1
      WHERE id = ? AND row_version = ?
    `),

    clientiById: db.prepare('SELECT * FROM clienti WHERE id = ?'),
    clientiContattiByCliente: db.prepare('SELECT * FROM clienti_contatti WHERE cliente_id = ? ORDER BY id ASC'),
    attivitaByCliente: db.prepare('SELECT * FROM attivita WHERE cliente_id = ? ORDER BY id DESC'),
    commesseByCliente: db.prepare('SELECT * FROM commesse WHERE cliente_id = ? ORDER BY id DESC'),
    kanbanByCliente: db.prepare('SELECT * FROM kanban_card WHERE cliente_id = ? ORDER BY id DESC'),
    fattureByCliente: db.prepare('SELECT * FROM fatture WHERE cliente_id = ? ORDER BY id DESC'),

    utentiById: db.prepare(`
      SELECT id, username, role, email, telefono, nome, cognome, mezzo, targa, rimborso_km,
             created_at, updated_at, row_version
      FROM utenti
      WHERE id = ?
    `),
    attivitaByUser: db.prepare('SELECT * FROM attivita WHERE user_id = ? ORDER BY id DESC'),
    noteSpeseByUser: db.prepare('SELECT * FROM note_spese WHERE user_id = ? ORDER BY id DESC'),
    trackingByUser: db.prepare('SELECT * FROM commesse_ore WHERE user_id = ? ORDER BY id DESC'),
    kanbanCommentiByUser: db.prepare('SELECT * FROM kanban_card_commenti WHERE user_id = ? ORDER BY id DESC'),
    kanbanNotificheByUser: db.prepare('SELECT * FROM kanban_notifiche WHERE user_id = ? ORDER BY id DESC'),
    privacyHandledByUser: db.prepare('SELECT * FROM privacy_requests WHERE handled_by = ? ORDER BY id DESC'),

    clienteAnonymize: db.prepare(`
      UPDATE clienti
      SET denominazione = ?,
          qualifica = NULL,
          nome = NULL,
          cognome = NULL,
          paese = NULL,
          codice_destinatario_sdi = NULL,
          indirizzo = NULL,
          comune = NULL,
          cap = NULL,
          provincia = NULL,
          partita_iva = NULL,
          codice_fiscale = NULL,
          email = NULL,
          pec = NULL,
          updated_at = datetime('now', 'localtime'),
          row_version = row_version + 1
      WHERE id = ?
    `),
    clienteContattiAnonymize: db.prepare(`
      UPDATE clienti_contatti
      SET nome = '[ANONYMIZED]',
          ruolo = NULL,
          telefono = NULL,
          email = NULL,
          updated_at = datetime('now', 'localtime'),
          row_version = row_version + 1
      WHERE cliente_id = ?
    `),

    utenteAnonymize: db.prepare(`
      UPDATE utenti
      SET username = ?,
          role = 'user',
          email = NULL,
          telefono = NULL,
          nome = NULL,
          cognome = NULL,
          mezzo = NULL,
          targa = NULL,
          rimborso_km = 0,
          password_hash = ?,
          password_salt = ?,
          updated_at = datetime('now', 'localtime'),
          row_version = row_version + 1
      WHERE id = ?
    `),
    revokeSessions: db.prepare('DELETE FROM sessioni WHERE user_id = ?'),
    revokeRefreshTokens: db.prepare(`
      UPDATE refresh_tokens
      SET revoked_at = datetime('now', 'localtime')
      WHERE user_id = ? AND revoked_at IS NULL
    `),
    deletePresence: db.prepare('DELETE FROM utenti_presenze WHERE user_id = ?'),
    privacyAuditCreate: db.prepare(`
      INSERT INTO privacy_requests (
        requester_type, requester_id, requester_label, request_type, status,
        opened_at, due_at, closed_at, notes, handled_by, payload_json
      ) VALUES (?, ?, ?, ?, 'done', datetime('now', 'localtime'), datetime('now', 'localtime'), datetime('now', 'localtime'), ?, ?, ?)
    `)
  };

  const buildClienteExport = (id) => ({
    generated_at: new Date().toISOString(),
    subject: { type: 'cliente', id },
    cliente: stmt.clientiById.get(id),
    contatti: stmt.clientiContattiByCliente.all(id),
    attivita: stmt.attivitaByCliente.all(id),
    commesse: stmt.commesseByCliente.all(id),
    kanban_card: stmt.kanbanByCliente.all(id),
    fatture: stmt.fattureByCliente.all(id)
  });

  const buildUtenteExport = (id) => ({
    generated_at: new Date().toISOString(),
    subject: { type: 'utente', id },
    utente: stmt.utentiById.get(id),
    attivita: stmt.attivitaByUser.all(id),
    note_spese: stmt.noteSpeseByUser.all(id),
    tracking: stmt.trackingByUser.all(id),
    kanban_commenti: stmt.kanbanCommentiByUser.all(id),
    kanban_notifiche: stmt.kanbanNotificheByUser.all(id),
    privacy_requests_as_handler: stmt.privacyHandledByUser.all(id)
  });

  router.get('/requests', (req, res) => {
    try {
      const rows = stmt.privacyGetAll.all().map((row) => ({
        ...row,
        payload: safeJsonParse(row.payload_json)
      }));
      return res.json(rows);
    } catch (error) {
      Logger.error('Errore GET /privacy/requests', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  router.post('/requests', (req, res) => {
    try {
      const body = req.body || {};
      const requesterType = String(body.requester_type || '').trim().toLowerCase();
      const requestType = String(body.request_type || '').trim().toLowerCase();
      const requesterId = body.requester_id == null ? null : parseId(body.requester_id);
      const requesterLabel = body.requester_label ? String(body.requester_label).trim() : null;
      const status = body.status ? String(body.status).trim().toLowerCase() : 'open';
      const notes = body.notes ? String(body.notes).trim() : null;
      const dueAt = body.due_at ? String(body.due_at).trim() : addDaysIso(30);
      const payload = body.payload == null ? null : body.payload;

      if (!requesterType) {
        return res.status(400).json({ error: 'requester_type obbligatorio' });
      }
      if (!REQUEST_TYPES.has(requestType)) {
        return res.status(400).json({ error: 'request_type non valido' });
      }
      if (!REQUEST_STATUS.has(status)) {
        return res.status(400).json({ error: 'status non valido' });
      }

      const result = stmt.privacyCreate.run(
        requesterType,
        requesterId,
        requesterLabel,
        requestType,
        status,
        dueAt,
        notes,
        req.user?.id || null,
        payload ? JSON.stringify(payload) : null
      );
      const created = stmt.privacyGetById.get(result.lastInsertRowid);
      return res.status(201).json({
        ...created,
        payload: safeJsonParse(created?.payload_json)
      });
    } catch (error) {
      Logger.error('Errore POST /privacy/requests', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  router.put('/requests/:id', (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'ID non valido' });
      }
      const existing = stmt.privacyGetById.get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Richiesta non trovata' });
      }

      const body = req.body || {};
      const nextStatus = body.status ? String(body.status).trim().toLowerCase() : existing.status;
      const nextDueAt = body.due_at == null ? existing.due_at : String(body.due_at).trim();
      const nextNotes = body.notes == null ? existing.notes : String(body.notes).trim();
      const nextPayload = body.payload == null
        ? existing.payload_json
        : JSON.stringify(body.payload);
      const rowVersion = Number(body.row_version);

      if (!REQUEST_STATUS.has(nextStatus)) {
        return res.status(400).json({ error: 'status non valido' });
      }
      if (!Number.isInteger(rowVersion)) {
        return res.status(400).json({ error: 'row_version obbligatorio' });
      }

      const closedAt = (nextStatus === 'done' || nextStatus === 'rejected')
        ? new Date().toISOString()
        : null;

      const result = stmt.privacyUpdate.run(
        nextStatus,
        nextDueAt || null,
        closedAt,
        nextNotes || null,
        req.user?.id || null,
        nextPayload,
        id,
        rowVersion
      );
      if (result.changes === 0) {
        return res.status(409).json({ error: 'Conflitto di aggiornamento', current: stmt.privacyGetById.get(id) });
      }

      const updated = stmt.privacyGetById.get(id);
      return res.json({
        ...updated,
        payload: safeJsonParse(updated?.payload_json)
      });
    } catch (error) {
      Logger.error('Errore PUT /privacy/requests/:id', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  const respondExport = (subjectType, id, res) => {
    const payload = subjectType === 'cliente'
      ? buildClienteExport(id)
      : buildUtenteExport(id);
    const entity = subjectType === 'cliente' ? payload.cliente : payload.utente;
    if (!entity) {
      return res.status(404).json({ error: `${subjectType} non trovato` });
    }
    res.setHeader('Content-Type', 'application/json');
    return res.json(payload);
  };

  router.get('/export/:subjectType/:id', (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'ID non valido' });
      }
      const subjectType = String(req.params.subjectType || '').trim().toLowerCase();
      if (subjectType !== 'cliente' && subjectType !== 'utente') {
        return res.status(400).json({ error: 'subjectType non valido (cliente|utente)' });
      }

      return respondExport(subjectType, id, res);
    } catch (error) {
      Logger.error('Errore GET /privacy/export/:subjectType/:id', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Backward compatibility
  router.get('/export/cliente/:id', (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'ID cliente non valido' });
      }
      return respondExport('cliente', id, res);
    } catch (error) {
      Logger.error('Errore GET /privacy/export/cliente/:id', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  // Backward compatibility
  router.get('/export/utente/:id', (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'ID utente non valido' });
      }
      return respondExport('utente', id, res);
    } catch (error) {
      Logger.error('Errore GET /privacy/export/utente/:id', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  router.post('/anonymize/cliente/:id', (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'ID cliente non valido' });
      }
      const existing = stmt.clientiById.get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Cliente non trovato' });
      }

      const transaction = db.transaction(() => {
        const clienteResult = stmt.clienteAnonymize.run(`[ANONYMIZED CLIENT ${id}]`, id);
        const contattiResult = stmt.clienteContattiAnonymize.run(id);
        stmt.privacyAuditCreate.run(
          'cliente',
          id,
          `Cliente ${id}`,
          'erasure',
          `Anonymize cliente eseguito da admin ${req.user?.id || 'n/a'}`,
          req.user?.id || null,
          JSON.stringify({
            action: 'anonymize_cliente',
            cliente_id: id,
            cliente_changes: clienteResult.changes,
            contatti_changes: contattiResult.changes
          })
        );
        return { clienteChanges: clienteResult.changes, contattiChanges: contattiResult.changes };
      });

      const result = transaction();
      Logger.warn('Anonymize cliente eseguito', { clienteId: id, byUserId: req.user?.id || null });
      return res.json({ success: true, ...result });
    } catch (error) {
      Logger.error('Errore POST /privacy/anonymize/cliente/:id', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  router.post('/anonymize/utente/:id', (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'ID utente non valido' });
      }
      if (Number(req.user?.id) === id) {
        return res.status(400).json({ error: 'Non puoi anonimizzare il tuo utente' });
      }

      const existing = stmt.utentiById.get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      const randomPassword = crypto.randomBytes(32).toString('hex');
      const { hash, salt } = hashPassword(randomPassword);
      const anonUsername = `deleted_user_${id}_${Date.now()}`;

      const transaction = db.transaction(() => {
        const updateResult = stmt.utenteAnonymize.run(anonUsername, hash, salt, id);
        stmt.revokeSessions.run(id);
        stmt.revokeRefreshTokens.run(id);
        stmt.deletePresence.run(id);
        stmt.privacyAuditCreate.run(
          'utente',
          id,
          `Utente ${id}`,
          'erasure',
          `Anonymize utente eseguito da admin ${req.user?.id || 'n/a'}`,
          req.user?.id || null,
          JSON.stringify({
            action: 'anonymize_utente',
            utente_id: id,
            user_changes: updateResult.changes
          })
        );
        return { userChanges: updateResult.changes };
      });

      const result = transaction();
      Logger.warn('Anonymize utente eseguito', { userId: id, byUserId: req.user?.id || null });
      return res.json({ success: true, ...result });
    } catch (error) {
      Logger.error('Errore POST /privacy/anonymize/utente/:id', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  router.get('/retention', (req, res) => {
    try {
      const config = {
        enabled: (process.env.PRIVACY_RETENTION_ENABLED || 'true').toLowerCase() === 'true',
        run_hours: parseInt(process.env.PRIVACY_RETENTION_RUN_HOURS || '24', 10),
        privacy_request_retention_days: parseInt(process.env.PRIVACY_REQUEST_RETENTION_DAYS || '730', 10),
        security_event_retention_days: parseInt(process.env.SECURITY_EVENT_RETENTION_DAYS || '90', 10)
      };
      return res.json(config);
    } catch (error) {
      Logger.error('Errore GET /privacy/retention', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  router.post('/retention/run', (req, res) => {
    try {
      if (!privacyRetention || typeof privacyRetention.run !== 'function') {
        return res.status(503).json({ error: 'Retention service non disponibile' });
      }
      const body = req.body || {};
      const privacyDays = Number.parseInt(body.privacyDays || process.env.PRIVACY_REQUEST_RETENTION_DAYS || '730', 10);
      const securityDays = Number.parseInt(body.securityDays || process.env.SECURITY_EVENT_RETENTION_DAYS || '90', 10);
      const result = privacyRetention.run({ privacyDays, securityDays });
      Logger.info('Retention manuale eseguita da admin', {
        byUserId: req.user?.id || null,
        privacyDays,
        securityDays,
        ...result
      });
      return res.json({
        success: true,
        privacyDays,
        securityDays,
        ...result
      });
    } catch (error) {
      Logger.error('Errore POST /privacy/retention/run', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  return router;
}

module.exports = createRouter;
