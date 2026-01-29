const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Logger = require('../utils/logger');
const fileValidator = require('../utils/fileValidator');
const ErrorHandler = require('../utils/errorHandler');
const { validateRequest } = require('../utils/validationMiddleware');
const ValidationSchemas = require('../utils/validationSchemas');

const uploadsRoot = path.join(__dirname, '..', 'uploads', 'documenti-aziendali');
const uploadsBase = path.resolve(path.join(__dirname, '..', 'uploads'));

const resolveUploadPath = (relativePath) => {
  const raw = String(relativePath || '').replace(/^\/+/, '');
  if (!raw) return null;
  const candidate = (raw.startsWith('uploads/') || raw.startsWith('uploads\\'))
    ? path.resolve(path.join(__dirname, '..', raw))
    : path.resolve(path.join(uploadsBase, raw));
  if (!candidate.startsWith(`${uploadsBase}${path.sep}`)) {
    return null;
  }
  return candidate;
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir(uploadsRoot);
    cb(null, uploadsRoot);
  },
  filename: (req, file, cb) => {
    const safeBase = path
      .basename(file.originalname)
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    const unique = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}_${safeBase}`);
  }
});

const upload = multer({ storage });

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
          updated_at = datetime('now', 'localtime'),
          row_version = row_version + 1
        WHERE id = 1 AND row_version = ?
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
          updated_at = datetime('now', 'localtime'),
          row_version = row_version + 1
        WHERE id = 1 AND row_version = ?
      `),
      getDocumentiAziendali: this.db.prepare(`
        SELECT * FROM documenti_aziendali
        ORDER BY datetime(created_at) DESC, id DESC
      `),
      getDocumentoAziendaleById: this.db.prepare('SELECT * FROM documenti_aziendali WHERE id = ?'),
      createDocumentoAziendale: this.db.prepare(`
        INSERT INTO documenti_aziendali (
          filename,
          original_name,
          mime_type,
          file_size,
          file_path,
          categoria
        ) VALUES (?, ?, ?, ?, ?, ?)
      `),
      deleteDocumentoAziendale: this.db.prepare('DELETE FROM documenti_aziendali WHERE id = ?')
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
      const { ragione_sociale, partita_iva, codice_fiscale, row_version } = req.body;
      if (!Number.isInteger(Number(row_version))) {
        return res.status(400).json({ error: 'row_version obbligatorio' });
      }

      const result = this.stmt.updateDatiAziendali.run(
        ragione_sociale || '',
        partita_iva || '',
        codice_fiscale || '',
        row_version
      );
      if (result.changes === 0) {
        const current = this.stmt.getDatiAziendali.get();
        if (!current) {
          return res.status(404).json({ error: 'Dati aziendali non trovati' });
        }
        return res.status(409).json({ error: 'Conflitto di aggiornamento', current });
      }

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
        cassa_previdenziale,
        row_version
      } = req.body;
      if (!Number.isInteger(Number(row_version))) {
        return res.status(400).json({ error: 'row_version obbligatorio' });
      }

      const result = this.stmt.updateDatiFiscali.run(
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
        parseFloat(ritenuta_acconto) || 0,
        parseFloat(rivalsa_inps) || 0,
        cassa_previdenziale || '',
        row_version
      );
      if (result.changes === 0) {
        const current = this.stmt.getDatiFiscali.get();
        if (!current) {
          return res.status(404).json({ error: 'Dati fiscali non trovati' });
        }
        return res.status(409).json({ error: 'Conflitto di aggiornamento', current });
      }

      const updated = this.stmt.getDatiFiscali.get();
      res.json(updated);
    } catch (err) {
      console.error('Errore aggiornamento dati fiscali:', err);
      res.status(500).json({ error: 'Errore nell\'aggiornamento dei dati fiscali' });
    }
  }

  getDocumentiAziendali(req, res) {
    try {
      const documenti = this.stmt.getDocumentiAziendali.all();
      res.json(documenti);
    } catch (err) {
      console.error('Errore recupero documenti aziendali:', err);
      res.status(500).json({ error: 'Errore nel recupero dei documenti aziendali' });
    }
  }

  uploadDocumentoAziendale(req, res) {
    try {
      if (!req.file) {
        throw ErrorHandler.createError('File mancante', 400);
      }

      const validation = fileValidator.validate(req.file);
      if (!validation.valid) {
        throw ErrorHandler.createError(validation.error, 400);
      }

      const safeFileName = fileValidator.generateSafeFileName(req.file.originalname);
      const oldPath = req.file.path;
      const newPath = path.join(path.dirname(oldPath), safeFileName);

      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      }

      const filePath = path.relative(path.join(__dirname, '..'), newPath).replace(/\\/g, '/');
      const categoria = String(req.body?.categoria || '').trim();

      const result = this.stmt.createDocumentoAziendale.run(
        safeFileName,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        filePath,
        categoria
      );

      const created = this.stmt.getDocumentoAziendaleById.get(result.lastInsertRowid);
      Logger.info('POST /impostazioni/documenti-aziendali', { documentoId: created?.id });
      res.status(201).json(created);
    } catch (error) {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          Logger.error('Errore eliminazione file dopo upload fallito', e);
        }
      }

      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      Logger.error('Errore POST /impostazioni/documenti-aziendali', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  deleteDocumentoAziendale(req, res) {
    try {
      const { id } = req.params;
      const existing = this.stmt.getDocumentoAziendaleById.get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Documento non trovato' });
      }

      this.stmt.deleteDocumentoAziendale.run(id);
      if (existing.file_path) {
        const absolutePath = path.join(__dirname, '..', existing.file_path);
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      }

      Logger.info('DELETE /impostazioni/documenti-aziendali', { documentoId: id });
      res.json({ success: true });
    } catch (error) {
      Logger.error('Errore DELETE /impostazioni/documenti-aziendali', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
    }
  }

  downloadDocumentoAziendale(req, res) {
    try {
      const { id } = req.params;
      const existing = this.stmt.getDocumentoAziendaleById.get(id);
      if (!existing) {
        return res.status(404).json({ error: 'Documento non trovato' });
      }

      const absolutePath = resolveUploadPath(existing.file_path);
      if (!absolutePath || !fs.existsSync(absolutePath)) {
        return res.status(404).json({ error: 'File non trovato' });
      }

      const filename = existing.original_name || existing.filename || 'documento';
      if (existing.mime_type) {
        res.setHeader('Content-Type', existing.mime_type);
      }
      return res.download(absolutePath, filename);
    } catch (error) {
      Logger.error('Errore GET /impostazioni/documenti-aziendali/download', error);
      res.status(500).json({ error: ErrorHandler.sanitizeErrorMessage(error) });
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
  router.get('/documenti-aziendali', controller.getDocumentiAziendali.bind(controller));
  router.get('/documenti-aziendali/:id/download', validateRequest(ValidationSchemas.idParam('id')), (req, res) => controller.downloadDocumentoAziendale(req, res));
  router.post('/documenti-aziendali', upload.single('file'), (req, res) => controller.uploadDocumentoAziendale(req, res));
  router.delete('/documenti-aziendali/:id', validateRequest(ValidationSchemas.idParam('id')), (req, res) => controller.deleteDocumentoAziendale(req, res));

  return router;
}

module.exports = createRouter;




