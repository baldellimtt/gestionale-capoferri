const express = require('express');
const Logger = require('../utils/loggerWinston');
const FattureInCloudApi = require('../services/fattureInCloudApi');

const router = express.Router();

class FatturazioneController {
  constructor(db) {
    this.db = db;
    this.api = new FattureInCloudApi();
    this.initStatements();
  }

  initStatements() {
    this.stmt = {
      getClienteById: this.db.prepare('SELECT * FROM clienti WHERE id = ?'),
      getClienteByFicId: this.db.prepare('SELECT * FROM clienti WHERE fatture_in_cloud_id = ?'),
      getByFicId: this.db.prepare('SELECT * FROM fatture WHERE fic_document_id = ? AND fic_company_id = ?'),
      listLocal: this.db.prepare(`
        SELECT f.*, c.denominazione as cliente_nome
        FROM fatture f
        LEFT JOIN clienti c ON c.id = f.cliente_id
        ORDER BY datetime(f.created_at) DESC
        LIMIT 100
      `),
      listLocalByType: this.db.prepare(`
        SELECT f.*, c.denominazione as cliente_nome
        FROM fatture f
        LEFT JOIN clienti c ON c.id = f.cliente_id
        WHERE f.tipo_documento = ?
        ORDER BY datetime(f.created_at) DESC
        LIMIT 100
      `),
      insertLocal: this.db.prepare(`
        INSERT INTO fatture (
          fic_document_id,
          fic_company_id,
          cliente_id,
          commessa_ids,
          numero,
          data,
          tipo_documento,
          stato,
          totale,
          valuta,
          descrizione,
          payload_json,
          response_json,
          updated_at,
          row_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), 1)
      `)
      ,
      updateLocal: this.db.prepare(`
        UPDATE fatture SET
          cliente_id = ?,
          numero = ?,
          data = ?,
          tipo_documento = ?,
          stato = ?,
          totale = ?,
          valuta = ?,
          descrizione = ?,
          payload_json = ?,
          response_json = ?,
          updated_at = datetime('now', 'localtime'),
          row_version = row_version + 1
        WHERE id = ?
      `)
    };
  }

  async getStatus(req, res) {
    try {
      const configured = this.api.isConfigured();
      let companyId = '';
      if (configured) {
        companyId = await this.api.getCompanyId();
      }
      res.json({
        configured,
        companyId,
        baseUrl: this.api.baseUrl
      });
    } catch (error) {
      Logger.error('Errore GET /fatturazione/status', error);
      res.status(500).json({ error: error.message });
    }
  }

  listLocal(req, res) {
    try {
      const type = req.query.type ? String(req.query.type) : null;
      const list = type ? this.stmt.listLocalByType.all(type) : this.stmt.listLocal.all();
      res.json(list);
    } catch (error) {
      Logger.error('Errore GET /fatturazione/fatture', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getPreCreateInfo(req, res) {
    try {
      const type = String(req.query.type || 'invoice');
      const companyId = await this.api.getCompanyId();
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID non disponibile' });
      }
      const response = await this.api.requestJson(
        'GET',
        `/c/${companyId}/issued_documents/pre_create_info?type=${encodeURIComponent(type)}`
      );
      res.json(response);
    } catch (error) {
      Logger.error('Errore GET /fatturazione/precreate-info', error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message });
    }
  }

  async listIssuedDocuments(req, res) {
    try {
      const companyId = await this.api.getCompanyId();
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID non disponibile' });
      }

      const params = new URLSearchParams();
      if (req.query.type) params.append('type', String(req.query.type));
      if (req.query.year) params.append('year', String(req.query.year));
      if (req.query.page) params.append('page', String(req.query.page));
      if (req.query.per_page) params.append('per_page', String(req.query.per_page));

      const query = params.toString();
      const path = query
        ? `/c/${companyId}/issued_documents?${query}`
        : `/c/${companyId}/issued_documents`;

      const response = await this.api.requestJson('GET', path);
      res.json(response);
    } catch (error) {
      Logger.error('Errore GET /fatturazione/issued-documents', error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message });
    }
  }

  async getIssuedDocumentUrls(req, res) {
    try {
      const { id } = req.params;
      const companyId = await this.api.getCompanyId();
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID non disponibile' });
      }
      const response = await this.api.requestJson(
        'GET',
        `/c/${companyId}/issued_documents/${id}?fields=url,attachment_url`
      );
      const data = response?.data || response || {};
      res.json({
        url: data.url || data?.data?.url || null,
        attachment_url: data.attachment_url || data?.data?.attachment_url || null
      });
    } catch (error) {
      Logger.error('Errore GET /fatturazione/issued-documents/:id/urls', error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message });
    }
  }

  async syncIssuedDocuments(req, res) {
    try {
      const companyId = await this.api.getCompanyId();
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID non disponibile' });
      }

      const type = req.query.type ? String(req.query.type) : 'invoice';
      const year = req.query.year ? String(req.query.year) : '';
      const perPage = Number(req.query.per_page || 50);
      const maxPages = Number(req.query.max_pages || 10);

      let page = 1;
      let totalFetched = 0;
      let inserted = 0;
      let updated = 0;

      while (page <= maxPages) {
        const params = new URLSearchParams();
        if (type) params.append('type', type);
        if (year) params.append('year', year);
        params.append('page', String(page));
        params.append('per_page', String(perPage));

        const response = await this.api.requestJson('GET', `/c/${companyId}/issued_documents?${params.toString()}`);
        const data = response?.data || response?.items || response || {};
        const list = Array.isArray(data)
          ? data
          : (data.data || data.items || data.list || []);

        if (!Array.isArray(list) || list.length === 0) {
          break;
        }

        totalFetched += list.length;

        list.forEach((doc) => {
          const ficId = doc?.id ? String(doc.id) : '';
          if (!ficId) return;
          const existing = this.stmt.getByFicId.get(ficId, companyId);
          const entityId = doc?.entity?.id ? String(doc.entity.id) : '';
          const cliente = entityId ? this.stmt.getClienteByFicId.get(entityId) : null;
          const totale = doc?.amount_total ?? doc?.amount_gross ?? doc?.amount_net ?? 0;
          const valuta = doc?.currency?.id || doc?.currency || null;
          const descrizione = doc?.visible_subject || doc?.subject || doc?.description || null;

          if (!existing) {
            this.stmt.insertLocal.run(
              ficId,
              companyId,
              cliente?.id || null,
              null,
              doc?.number ? String(doc.number) : null,
              doc?.date || null,
              doc?.type || type || null,
              doc?.status || null,
              totale,
              valuta,
              descrizione,
              null,
              JSON.stringify(doc)
            );
            inserted += 1;
          } else {
            this.stmt.updateLocal.run(
              cliente?.id || existing.cliente_id,
              doc?.number ? String(doc.number) : existing.numero,
              doc?.date || existing.data,
              doc?.type || existing.tipo_documento,
              doc?.status || existing.stato,
              totale,
              valuta,
              descrizione || existing.descrizione,
              existing.payload_json,
              JSON.stringify(doc),
              existing.id
            );
            updated += 1;
          }
        });

        if (list.length < perPage) {
          break;
        }
        page += 1;
      }

      res.json({ success: true, totalFetched, inserted, updated, companyId, type, year });
    } catch (error) {
      Logger.error('Errore GET /fatturazione/sync', error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message });
    }
  }

  async createIssuedDocument(req, res) {
    try {
      const {
        cliente_id,
        clienteId,
        commessa_ids,
        type,
        date,
        numeration,
        currency,
        items,
        visible_subject,
        subject,
        notes,
        payment_method_id,
        payment_account_id,
        payment_due_date,
        payment_status,
        vat_id,
        recipient_code,
        recipient_pec
      } = req.body || {};

      const clienteIdResolved = clienteId || cliente_id || null;
      if (!clienteIdResolved) {
        return res.status(400).json({ error: 'cliente_id obbligatorio' });
      }

      const cliente = this.stmt.getClienteById.get(clienteIdResolved);
      if (!cliente) {
        return res.status(404).json({ error: 'Cliente non trovato' });
      }
      if (!cliente.fatture_in_cloud_id) {
        return res.status(400).json({ error: 'Cliente non sincronizzato con Fatture in Cloud' });
      }

      const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
      if (!safeItems.length) {
        return res.status(400).json({ error: 'items obbligatorio (almeno 1 riga)' });
      }
      if (safeItems.some((item) => !String(item.name || item.descrizione || item.description || '').trim())) {
        return res.status(400).json({ error: 'Ogni riga deve avere una descrizione' });
      }
      if (safeItems.some((item) => !Number.isFinite(Number(item.net_price ?? item.prezzo ?? 0)))) {
        return res.status(400).json({ error: 'Ogni riga deve avere un prezzo valido' });
      }

      const companyId = await this.api.getCompanyId();
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID non disponibile' });
      }

      const hasValue = (value) => value !== null && value !== undefined && value !== '';

      const docType = type || 'invoice';
      if (!['quote', 'proforma', 'invoice'].includes(docType)) {
        return res.status(400).json({ error: 'Tipo documento non valido' });
      }

      const mappedItems = safeItems.map((item) => ({
        name: String(item.name || item.descrizione || item.description || '').trim(),
        qty: Number(item.qty ?? 1),
        net_price: Number(item.net_price ?? item.prezzo ?? 0),
        vat: item.vat_id
          ? { id: item.vat_id }
          : (hasValue(vat_id) ? { id: vat_id } : undefined)
      }));

      const totalNet = mappedItems.reduce((sum, item) => {
        const qty = Number(item.qty || 0);
        const price = Number(item.net_price || 0);
        if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum;
        return sum + qty * price;
      }, 0);

      const eInvoiceData = {};
      if (hasValue(recipient_code)) {
        eInvoiceData.recipient_code = String(recipient_code).trim();
      }
      if (hasValue(recipient_pec)) {
        eInvoiceData.certified_email = String(recipient_pec).trim();
      }

      const payloadData = {
        entity: { id: String(cliente.fatture_in_cloud_id) },
        date: date || new Date().toISOString().slice(0, 10),
        numeration: numeration || undefined,
        currency: currency ? { id: currency } : { id: 'EUR' },
        items_list: mappedItems,
        subject: subject || undefined,
        visible_subject: visible_subject || subject || undefined,
        notes: notes || undefined,
        payment_method: hasValue(payment_method_id) ? { id: payment_method_id } : undefined,
        payments_list: payment_due_date ? {
          payments: [
            {
              due_date: payment_due_date,
              status: payment_status || 'not_paid',
              amount: Number.isFinite(totalNet) ? Number(totalNet.toFixed(2)) : undefined,
              payment_account: hasValue(payment_account_id) ? { id: payment_account_id } : undefined
            }
          ]
        } : undefined,
        e_invoice: docType === 'invoice' ? Object.keys(eInvoiceData).length > 0 : undefined,
        ei_data: docType === 'invoice' && Object.keys(eInvoiceData).length ? eInvoiceData : undefined
      };

      const result = await this.api.createDocument(docType, payloadData);
      const responseData = result?.data || {};
      const responseId = result?.id || null;
      const responseTotal = responseData?.amount_net
        || responseData?.amount_gross
        || responseData?.amount_total
        || null;

      this.stmt.insertLocal.run(
        responseId ? String(responseId) : null,
        companyId,
        clienteIdResolved,
        commessa_ids ? JSON.stringify(commessa_ids) : null,
        responseData?.number ? String(responseData.number) : null,
        responseData?.date || payloadData.date,
        docType,
        responseData?.status || null,
        responseTotal,
        payloadData.currency?.id || null,
        visible_subject || subject || null,
        JSON.stringify({ data: { ...payloadData, type: docType } }),
        JSON.stringify(result?.response || responseData)
      );

      res.status(201).json({
        data: result?.response || responseData,
        url_pdf: result?.url_pdf || null,
        local: {
          cliente_id: clienteIdResolved,
          fic_company_id: companyId,
          fic_document_id: responseId
        }
      });
    } catch (error) {
      Logger.error('Errore POST /fatturazione/issued-documents', error);
      const status = error.status || 500;
      res.status(status).json({ error: error.message });
    }
  }
}

function createRouter(db) {
  const controller = new FatturazioneController(db);

  router.get('/status', (req, res) => controller.getStatus(req, res));
  router.get('/fatture', (req, res) => controller.listLocal(req, res));
  router.get('/precreate-info', (req, res) => controller.getPreCreateInfo(req, res));
  router.get('/issued-documents', (req, res) => controller.listIssuedDocuments(req, res));
  router.get('/issued-documents/:id/urls', (req, res) => controller.getIssuedDocumentUrls(req, res));
  router.get('/sync', (req, res) => controller.syncIssuedDocuments(req, res));
  router.post('/issued-documents', (req, res) => controller.createIssuedDocument(req, res));

  return router;
}

module.exports = createRouter;
