const express = require('express');
const Logger = require('../utils/loggerWinston');
const { hashPassword } = require('../utils/auth');
const { defaultPolicy: passwordPolicy } = require('../utils/passwordPolicy');
const { validateRequest } = require('../utils/validationMiddleware');
const ValidationSchemas = require('../utils/validationSchemas');

const router = express.Router();

function createRouter(db) {
  const getAllStmt = db.prepare(`
    SELECT id, username, role, email, telefono, nome, cognome, mezzo, targa, rimborso_km, row_version, created_at, updated_at
    FROM utenti
    ORDER BY cognome ASC, nome ASC, username ASC
  `);
  const getByIdStmt = db.prepare('SELECT * FROM utenti WHERE id = ?');
  const createStmt = db.prepare(`
    INSERT INTO utenti (username, role, email, telefono, password_hash, password_salt, nome, cognome, mezzo, targa, rimborso_km)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateStmt = db.prepare(`
    UPDATE utenti SET
      username = ?,
      role = ?,
      email = ?,
      telefono = ?,
      nome = ?,
      cognome = ?,
      mezzo = ?,
      targa = ?,
      rimborso_km = ?,
      updated_at = datetime('now', 'localtime'),
      row_version = row_version + 1
    WHERE id = ? AND row_version = ?
  `);
  const updatePasswordStmt = db.prepare(`
    UPDATE utenti SET
      password_hash = ?,
      password_salt = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `);
  const deleteStmt = db.prepare('DELETE FROM utenti WHERE id = ?');

  router.get('/', (req, res) => {
    try {
      const utenti = getAllStmt.all();
      res.json(utenti);
    } catch (error) {
      Logger.error('Errore GET /utenti', error);
      res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  router.post('/', (req, res) => {
    try {
      const {
        username,
        role = 'user',
        password,
        email,
        telefono,
        nome,
        cognome,
        mezzo,
        targa,
        rimborso_km,
      } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({ error: 'Username e password obbligatori' });
      }

      // Valida password policy
      const passwordValidation = passwordPolicy.validate(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          error: 'Password non valida',
          details: passwordValidation.errors,
          suggestions: passwordPolicy.getSuggestions()
        });
      }

      const rateValue = Number(rimborso_km || 0);
      if (!Number.isFinite(rateValue) || rateValue < 0) {
        return res.status(400).json({ error: 'Costo km non valido' });
      }

      // IMPORTANTE: Rimuovi spazi bianchi iniziali/finali dalla password
      const trimmedPassword = password.trim();
      const { hash, salt } = hashPassword(trimmedPassword);
      const result = createStmt.run(
        username,
        role,
        email || null,
        telefono || null,
        hash,
        salt,
        nome || null,
        cognome || null,
        mezzo || null,
        targa || null,
        rateValue
      );

      Logger.info('Creato utente', { id: result.lastInsertRowid, username });
      const created = getByIdStmt.get(result.lastInsertRowid);
      return res.status(201).json({
        id: created.id,
        username: created.username,
        role: created.role,
        email: created.email,
        telefono: created.telefono,
        nome: created.nome,
        cognome: created.cognome,
        mezzo: created.mezzo,
        targa: created.targa,
        rimborso_km: created.rimborso_km,
        row_version: created.row_version,
      });
    } catch (error) {
      if (String(error?.message || '').includes('UNIQUE')) {
        return res.status(409).json({ error: 'Username già esistente' });
      }
      Logger.error('Errore POST /utenti', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  router.put('/:id', (req, res) => {
    try {
      const { id } = req.params;
      const {
        username,
        role = 'user',
        password,
        email,
        telefono,
        nome,
        cognome,
        mezzo,
        targa,
        rimborso_km,
        row_version,
      } = req.body || {};

      const existing = getByIdStmt.get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      if (!username) {
        return res.status(400).json({ error: 'Username obbligatorio' });
      }
      if (!Number.isInteger(Number(row_version))) {
        return res.status(400).json({ error: 'row_version obbligatorio' });
      }

      const rateValue = Number(rimborso_km || 0);
      if (!Number.isFinite(rateValue) || rateValue < 0) {
        return res.status(400).json({ error: 'Costo km non valido' });
      }

      const result = updateStmt.run(
        username,
        role,
        email || null,
        telefono || null,
        nome || null,
        cognome || null,
        mezzo || null,
        targa || null,
        rateValue,
        id,
        row_version
      );

      if (result.changes === 0) {
        const current = getByIdStmt.get(id);
        if (!current) {
          return res.status(404).json({ error: 'Utente non trovato' });
        }
        return res.status(409).json({ error: 'Conflitto di aggiornamento', current });
      }

      // IMPORTANTE: Aggiorna la password SOLO se fornita e non vuota
      // Questo evita di modificare accidentalmente la password quando si aggiorna un utente
      if (password && typeof password === 'string' && password.trim().length > 0) {
        // IMPORTANTE: Rimuovi spazi bianchi iniziali/finali dalla password
        const trimmedPassword = password.trim();
        
        // Valida password policy
        const passwordValidation = passwordPolicy.validate(trimmedPassword);
        if (!passwordValidation.valid) {
          return res.status(400).json({
            error: 'Password non valida',
            details: passwordValidation.errors,
            suggestions: passwordPolicy.getSuggestions()
          });
        }
        const { hash, salt } = hashPassword(trimmedPassword);
        updatePasswordStmt.run(hash, salt, id);
        Logger.info('Password aggiornata', { id, username });
      }

      const updated = getByIdStmt.get(id);
      return res.json({
        id: updated.id,
        username: updated.username,
        role: updated.role,
        email: updated.email,
        telefono: updated.telefono,
        nome: updated.nome,
        cognome: updated.cognome,
        mezzo: updated.mezzo,
        targa: updated.targa,
        rimborso_km: updated.rimborso_km,
        row_version: updated.row_version,
      });
    } catch (error) {
      if (String(error?.message || '').includes('UNIQUE')) {
        return res.status(409).json({ error: 'Username già esistente' });
      }
      Logger.error('Errore PUT /utenti', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const { id } = req.params;
      if (Number(id) === Number(req.user.id)) {
        return res.status(400).json({ error: 'Non puoi eliminare il tuo utente' });
      }

      const result = deleteStmt.run(id);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      Logger.info('Utente eliminato', { id });
      return res.json({ success: true });
    } catch (error) {
      Logger.error('Errore DELETE /utenti', error);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
  });

  return router;
}

module.exports = createRouter;
