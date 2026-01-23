const https = require('https');
const { URL } = require('url');
const Logger = require('../utils/loggerWinston');

class FattureInCloudSync {
  constructor(db) {
    this.db = db;
    this.baseUrl = process.env.FATTURE_IN_CLOUD_API_BASE || 'https://api-v2.fattureincloud.it';
    this.token = process.env.FATTURE_IN_CLOUD_API_TOKEN || '';
    this.companyId = process.env.FATTURE_IN_CLOUD_COMPANY_ID || '';
    this.enabled = (process.env.FATTURE_IN_CLOUD_SYNC_ENABLED || 'true').toLowerCase() === 'true';
    this.syncOnStartup = (process.env.FATTURE_IN_CLOUD_SYNC_ON_STARTUP || 'true').toLowerCase() === 'true';
    this.intervalHours = parseInt(process.env.FATTURE_IN_CLOUD_SYNC_INTERVAL_HOURS || '168', 10);
    this.pageSize = parseInt(process.env.FATTURE_IN_CLOUD_PAGE_SIZE || '100', 10);
    this.isRunning = false;
    this.initStatements();
  }

  initStatements() {
    this.stmt = {
      getByFicId: this.db.prepare('SELECT * FROM clienti WHERE fatture_in_cloud_id = ?'),
      getByPartitaIva: this.db.prepare('SELECT * FROM clienti WHERE partita_iva = ?'),
      getByCodiceFiscale: this.db.prepare('SELECT * FROM clienti WHERE codice_fiscale = ?'),
      getByDenominazione: this.db.prepare('SELECT * FROM clienti WHERE lower(denominazione) = lower(?)'),
      insert: this.db.prepare(`
        INSERT INTO clienti (
          denominazione, qualifica, nome, cognome, paese, codice_destinatario_sdi,
          indirizzo, comune, cap, provincia, partita_iva, codice_fiscale,
          email, pec, fatture_in_cloud_id, fatture_in_cloud_updated_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `),
      update: this.db.prepare(`
        UPDATE clienti SET
          denominazione = ?, qualifica = ?, nome = ?, cognome = ?, paese = ?, codice_destinatario_sdi = ?,
          indirizzo = ?, comune = ?, cap = ?, provincia = ?,
          partita_iva = ?, codice_fiscale = ?, email = ?, pec = ?,
          fatture_in_cloud_id = ?, fatture_in_cloud_updated_at = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `)
    };
  }

  start() {
    if (!this.enabled) {
      Logger.info('Sync Fatture in Cloud disabilitato');
      return;
    }

    if (!this.token) {
      Logger.warn('Token Fatture in Cloud mancante: sync disabilitato');
      return;
    }

    if (this.syncOnStartup) {
      this.run().catch((err) => {
        Logger.error('Errore sync Fatture in Cloud (startup)', { error: err.message });
      });
    }

    const intervalMs = this.intervalHours > 0 ? this.intervalHours * 60 * 60 * 1000 : 0;
    if (intervalMs > 0) {
      setInterval(() => {
        this.run().catch((err) => {
          Logger.error('Errore sync Fatture in Cloud (periodico)', { error: err.message });
        });
      }, intervalMs);
      Logger.info(`Sync Fatture in Cloud configurato (ogni ${this.intervalHours} ore)`);
    } else {
      Logger.info('Sync Fatture in Cloud senza intervallo periodico');
    }
  }

  async run() {
    if (this.isRunning) {
      Logger.warn('Sync Fatture in Cloud già in esecuzione, skip');
      return;
    }
    this.isRunning = true;
    const startedAt = Date.now();
    try {
      const companyId = await this.resolveCompanyId();
      if (!companyId) {
        Logger.warn('Company ID Fatture in Cloud non disponibile: sync saltata');
        return;
      }
      const clients = await this.fetchAllClients(companyId);
      const result = this.upsertClients(clients);
      const durationMs = Date.now() - startedAt;
      Logger.info('Sync Fatture in Cloud completata', { ...result, durationMs });
    } finally {
      this.isRunning = false;
    }
  }

  async resolveCompanyId() {
    if (this.companyId) {
      return this.companyId;
    }
    const response = await this.requestJson('/user/companies');
    const data = response?.data || response?.companies || response?.items || response || {};
    const companies = Array.isArray(data)
      ? data
      : (data.companies || data.data || data.items || []);
    if (!companies.length) {
      return '';
    }
    const company = companies[0];
    this.companyId = String(company.id || company.company_id || '');
    if (this.companyId) {
      const name = company.name || company.ragione_sociale || company.business_name || 'azienda';
      Logger.info('Company ID Fatture in Cloud rilevato', { companyId: this.companyId, companyName: name });
    }
    return this.companyId;
  }

  async fetchAllClients(companyId) {
    const allClients = [];
    let page = 1;
    const pageSize = Number.isNaN(this.pageSize) || this.pageSize <= 0 ? 100 : this.pageSize;
    while (true) {
      const query = `?page=${page}&per_page=${pageSize}`;
      const response = await this.requestJson(`/c/${companyId}/entities/clients${query}`);
      const data = response?.data || response?.clients || response?.items || response || {};
      const items = Array.isArray(data)
        ? data
        : (data.data || data.items || data.list || data.clients || []);
      if (Array.isArray(items) && items.length > 0) {
        allClients.push(...items);
      }
      if (!items || items.length < pageSize) {
        break;
      }
      page += 1;
    }
    return allClients;
  }

  upsertClients(clients) {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const normalize = (value) => {
      if (value === null || value === undefined) return null;
      const trimmed = String(value).trim();
      return trimmed === '' ? null : trimmed;
    };

    const mapClient = (client) => {
      const address = client.address || {};
      const email = client.email || client.contacts?.email || client.email_address;
      const pec = client.certified_email || client.pec || client.contacts?.certified_email;
      const qualifica = client.type === 'company'
        ? 'Societa'
        : (client.type === 'person' ? 'Persona fisica' : null);

      return {
        denominazione: normalize(client.name || client.business_name || client.denomination || ''),
        qualifica: normalize(qualifica),
        nome: normalize(client.first_name || client.name_first || client.given_name),
        cognome: normalize(client.last_name || client.name_last || client.family_name),
        paese: normalize(address.country || client.country),
        codice_destinatario_sdi: normalize(client.ei_code || client.italian_einvoice_code),
        indirizzo: normalize(address.street || address.address || client.address_street),
        comune: normalize(address.city || client.address_city),
        cap: normalize(address.postal_code || client.address_postal_code),
        provincia: normalize(address.province || client.address_province),
        partita_iva: normalize(client.vat_number || client.vat_code),
        codice_fiscale: normalize(client.tax_code || client.fiscal_code),
        email: normalize(email),
        pec: normalize(pec),
        fatture_in_cloud_id: normalize(client.id),
        fatture_in_cloud_updated_at: normalize(client.updated_at || client.updatedAt || client.last_update_date)
      };
    };

    for (const client of clients || []) {
      const mapped = mapClient(client);
      if (!mapped.denominazione) {
        skipped += 1;
        continue;
      }

      let existing = null;
      if (mapped.fatture_in_cloud_id) {
        existing = this.stmt.getByFicId.get(mapped.fatture_in_cloud_id);
      }
      if (!existing && mapped.partita_iva) {
        existing = this.stmt.getByPartitaIva.get(mapped.partita_iva);
      }
      if (!existing && mapped.codice_fiscale) {
        existing = this.stmt.getByCodiceFiscale.get(mapped.codice_fiscale);
      }
      if (!existing && mapped.denominazione) {
        existing = this.stmt.getByDenominazione.get(mapped.denominazione);
      }

      if (!existing) {
        this.stmt.insert.run(
          mapped.denominazione,
          mapped.qualifica,
          mapped.nome,
          mapped.cognome,
          mapped.paese,
          mapped.codice_destinatario_sdi,
          mapped.indirizzo,
          mapped.comune,
          mapped.cap,
          mapped.provincia,
          mapped.partita_iva,
          mapped.codice_fiscale,
          mapped.email,
          mapped.pec,
          mapped.fatture_in_cloud_id,
          mapped.fatture_in_cloud_updated_at
        );
        inserted += 1;
        continue;
      }

      const merged = {
        denominazione: mapped.denominazione || existing.denominazione,
        qualifica: mapped.qualifica || existing.qualifica,
        nome: mapped.nome || existing.nome,
        cognome: mapped.cognome || existing.cognome,
        paese: mapped.paese || existing.paese,
        codice_destinatario_sdi: mapped.codice_destinatario_sdi || existing.codice_destinatario_sdi,
        indirizzo: mapped.indirizzo || existing.indirizzo,
        comune: mapped.comune || existing.comune,
        cap: mapped.cap || existing.cap,
        provincia: mapped.provincia || existing.provincia,
        partita_iva: mapped.partita_iva || existing.partita_iva,
        codice_fiscale: mapped.codice_fiscale || existing.codice_fiscale,
        email: mapped.email || existing.email,
        pec: mapped.pec || existing.pec,
        fatture_in_cloud_id: mapped.fatture_in_cloud_id || existing.fatture_in_cloud_id,
        fatture_in_cloud_updated_at: mapped.fatture_in_cloud_updated_at || existing.fatture_in_cloud_updated_at
      };

      const hasChanges = Object.keys(merged).some((key) => merged[key] !== existing[key]);
      if (!hasChanges) {
        skipped += 1;
        continue;
      }

      this.stmt.update.run(
        merged.denominazione,
        merged.qualifica,
        merged.nome,
        merged.cognome,
        merged.paese,
        merged.codice_destinatario_sdi,
        merged.indirizzo,
        merged.comune,
        merged.cap,
        merged.provincia,
        merged.partita_iva,
        merged.codice_fiscale,
        merged.email,
        merged.pec,
        merged.fatture_in_cloud_id,
        merged.fatture_in_cloud_updated_at,
        existing.id
      );
      updated += 1;
    }

    return { inserted, updated, skipped, total: clients ? clients.length : 0 };
  }

  requestJson(pathname) {
    const url = new URL(pathname, this.baseUrl);
    const options = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json'
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }
}

module.exports = FattureInCloudSync;
