const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const TOKEN_STORAGE_KEY = 'gestionale_auth_token';
const REFRESH_TOKEN_STORAGE_KEY = 'gestionale_refresh_token';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem(TOKEN_STORAGE_KEY) || null;
    this.refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || null;
    this.refreshing = false;
    this.refreshPromise = null;
    this.refreshBlockedUntil = null;
    // Cache per /auth/me per evitare chiamate eccessive
    this.meCache = {
      data: null,
      timestamp: null,
      ttl: 5 * 60 * 1000 // 5 minuti di cache
    };
    this.mePromise = null; // Evita chiamate simultanee duplicate
    
    // Cache per dati statici (clienti, utenti, commesse)
    this.clientiCache = {
      data: null,
      timestamp: null,
      search: null,
      ttl: 10 * 60 * 1000 // 10 minuti di cache
    };
    this.utentiCache = {
      data: null,
      timestamp: null,
      ttl: 10 * 60 * 1000 // 10 minuti di cache
    };
    this.commesseCache = {
      data: null,
      timestamp: null,
      filters: null,
      ttl: 5 * 60 * 1000 // 5 minuti di cache
    };
    this.clientiPromise = null;
    this.utentiPromise = null;
    this.commessePromise = null;
  }

  setToken(token, refreshToken = null) {
    this.token = token;
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    if (refreshToken) {
      this.refreshToken = refreshToken;
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
    }
  }

  getToken() {
    return this.token;
  }

  getRefreshToken() {
    return this.refreshToken || localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  }

  clearTokens() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    this.clearMeCache();
    this.refreshBlockedUntil = null;
  }

  async refreshAccessToken() {
    // Evita multiple chiamate simultanee di refresh
    if (this.refreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('Nessun refresh token disponibile');
    }

    this.refreshing = true;
    this.refreshPromise = fetch(`${this.baseURL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          const error = new Error(data.error || 'Refresh token fallito');
          error.status = response.status;
          if (response.status === 429) {
            error.retryAfter = data.retryAfter || 60;
          }
          if (data.details) {
            error.details = data.details;
          }
          throw error;
        }
        return response.json();
      })
      .then((data) => {
        if (data.token) {
          if (data.refreshToken) {
            this.setToken(data.token, data.refreshToken);
          } else {
            this.setToken(data.token);
          }
          this.refreshBlockedUntil = null;
          return data.token;
        }
        throw new Error('Token non ricevuto dal server');
      })
      .finally(() => {
        this.refreshing = false;
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      // Per DELETE, la risposta potrebbe essere vuota o contenere JSON
      let data = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (e) {
            // Se il parsing fallisce, usa un oggetto vuoto
            data = {};
          }
        }
      }

      // Se il token è scaduto (401), prova a fare refresh
      if (response.status === 401 && this.getRefreshToken() && !endpoint.includes('/auth/')) {
        try {
          if (this.refreshBlockedUntil && Date.now() < this.refreshBlockedUntil) {
            const retryAfter = Math.ceil((this.refreshBlockedUntil - Date.now()) / 1000);
            const error = new Error('Troppe richieste, riprova piÃ¹ tardi');
            error.status = 429;
            error.retryAfter = retryAfter;
            throw error;
          }
          const newToken = await this.refreshAccessToken();
          // Riprova la richiesta con il nuovo token
          config.headers.Authorization = `Bearer ${newToken}`;
          const retryResponse = await fetch(url, config);
          
          if (!retryResponse.ok) {
            const retryData = await retryResponse.json().catch(() => ({}));
            if (retryResponse.status === 401) {
              const error = new Error(retryData.error || 'Sessione scaduta. Effettua nuovamente l\'accesso.');
              error.status = 401;
              throw error;
            }
            
            // Gestione speciale per errori 429
            if (retryResponse.status === 429) {
              const retryAfter = retryData.retryAfter || 60;
              const error = new Error(retryData.error || 'Troppe richieste, riprova più tardi');
              error.status = 429;
              error.retryAfter = retryAfter;
              throw error;
            }
            
            const error = new Error(retryData.error || `HTTP error! status: ${retryResponse.status}`);
            error.status = retryResponse.status;
            if (retryData.details) {
              error.details = retryData.details;
            }
            throw error;
          }

          // Parse della risposta di retry
          const retryContentType = retryResponse.headers.get('content-type');
          if (retryContentType && retryContentType.includes('application/json')) {
            const retryText = await retryResponse.text();
            if (retryText) {
              try {
                data = JSON.parse(retryText);
              } catch (e) {
                data = {};
              }
            }
          }

          if (options.method === 'DELETE' && Object.keys(data).length === 0) {
            return { success: true };
          }

          return data;
        } catch (refreshError) {
          // Se il refresh Ã¨ limitato, non fare logout: aspetta il retryAfter
          if (refreshError.status === 429) {
            const retryAfter = refreshError.retryAfter || 60;
            this.refreshBlockedUntil = Date.now() + retryAfter * 1000;
            throw refreshError;
          }
          // Se il refresh fallisce, pulisci i token e rilancia l'errore
          throw refreshError;
        }
      }

      if (!response.ok) {
        const error = new Error(data.error || `HTTP error! status: ${response.status}`);
        error.status = response.status;
        // Passa anche i dettagli di validazione se presenti
        if (data.details) {
          error.details = data.details;
        }
        throw error;
      }

      // Per DELETE, se non c'è data, restituisci success: true
      if (options.method === 'DELETE' && Object.keys(data).length === 0) {
        return { success: true };
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  async requestForm(endpoint, formData, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      method: 'POST',
      ...options,
      headers: {
        ...options.headers,
      },
      body: formData,
    };

    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, config);
      let data = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text) {
          data = JSON.parse(text);
        }
      }

      if (!response.ok) {
        const error = new Error(data.error || `HTTP error! status: ${response.status}`);
        error.status = response.status;
        // Passa anche i dettagli di validazione se presenti
        if (data.details) {
          error.details = data.details;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // Auth API
  async login(credentials) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: credentials,
    });

    // Salva sia access token che refresh token
    if (data.token) {
      this.setToken(data.token, data.refreshToken);
    }

    return data;
  }

  async logout() {
    try {
      const refreshToken = this.getRefreshToken();
      await this.request('/auth/logout', { method: 'POST', body: { refreshToken } });
    } finally {
      this.clearTokens();
    }
  }

  async me(forceRefresh = false) {
    // Usa cache se disponibile e non è scaduta
    const now = Date.now();
    if (!forceRefresh && this.meCache.data && this.meCache.timestamp && 
        (now - this.meCache.timestamp) < this.meCache.ttl) {
      return Promise.resolve(this.meCache.data);
    }

    // Se c'è già una chiamata in corso, aspetta quella
    if (this.mePromise) {
      return this.mePromise;
    }

    // Fai la chiamata e salva in cache
    this.mePromise = this.request('/auth/me')
      .then(data => {
        this.meCache.data = data;
        this.meCache.timestamp = now;
        this.mePromise = null;
        return data;
      })
      .catch(err => {
        this.mePromise = null;
        // Se errore 401, pulisci cache
        if (err.status === 401) {
          this.meCache.data = null;
          this.meCache.timestamp = null;
        }
        throw err;
      });

    return this.mePromise;
  }

  clearMeCache() {
    this.meCache.data = null;
    this.meCache.timestamp = null;
  }

  clearClientiCache() {
    this.clientiCache.data = null;
    this.clientiCache.timestamp = null;
    this.clientiCache.search = null;
  }

  clearUtentiCache() {
    this.utentiCache.data = null;
    this.utentiCache.timestamp = null;
  }

  clearCommesseCache() {
    this.commesseCache.data = null;
    this.commesseCache.timestamp = null;
    this.commesseCache.filters = null;
  }

  clearAllCaches() {
    this.clearMeCache();
    this.clearClientiCache();
    this.clearUtentiCache();
    this.clearCommesseCache();
  }

  async updateMe(payload) {
    const result = await this.request('/auth/me', {
      method: 'PUT',
      body: payload,
    });
    // Aggiorna cache dopo update
    if (this.meCache.data) {
      this.meCache.data = { ...this.meCache.data, ...result };
    }
    return result;
  }

  // Utenti API (admin)
  async getUtenti(forceRefresh = false) {
    // Usa cache se disponibile e non è scaduta
    const now = Date.now();
    if (!forceRefresh && this.utentiCache.data && this.utentiCache.timestamp && 
        (now - this.utentiCache.timestamp) < this.utentiCache.ttl) {
      return Promise.resolve(this.utentiCache.data);
    }

    // Se c'è già una chiamata in corso, aspetta quella
    if (this.utentiPromise) {
      return this.utentiPromise;
    }

    // Fai la chiamata e salva in cache
    this.utentiPromise = this.request('/utenti')
      .then(data => {
        this.utentiCache.data = data;
        this.utentiCache.timestamp = now;
        this.utentiPromise = null;
        return data;
      })
      .catch(err => {
        this.utentiPromise = null;
        throw err;
      });

    return this.utentiPromise;
  }

  async createUtente(payload) {
    return this.request('/utenti', {
      method: 'POST',
      body: payload,
    });
  }

  async updateUtente(id, payload) {
    const result = await this.request(`/utenti/${id}`, {
      method: 'PUT',
      body: payload,
    });
    // Invalida cache utenti dopo aggiornamento
    this.clearUtentiCache();
    return result;
  }

  async deleteUtente(id) {
    const result = await this.request(`/utenti/${id}`, {
      method: 'DELETE',
    });
    // Invalida cache utenti dopo eliminazione
    this.clearUtentiCache();
    return result;
  }

  // Commesse API
  async getCommesse(filters = {}, forceRefresh = false) {
    const params = new URLSearchParams();
    if (filters.clienteId) params.append('clienteId', filters.clienteId);
    if (filters.stato) params.append('stato', filters.stato);
    if (filters.statoPagamenti) params.append('statoPagamenti', filters.statoPagamenti);
    const query = params.toString();
    const endpoint = query ? `/commesse?${query}` : '/commesse';
    
    // Crea una chiave cache basata sui filtri
    const filtersKey = JSON.stringify(filters);
    
    // Usa cache se disponibile, non scaduta e con gli stessi filtri
    const now = Date.now();
    if (!forceRefresh && this.commesseCache.data && this.commesseCache.timestamp && 
        this.commesseCache.filters === filtersKey &&
        (now - this.commesseCache.timestamp) < this.commesseCache.ttl) {
      return Promise.resolve(this.commesseCache.data);
    }

    // Se c'è già una chiamata in corso per questi filtri, aspetta quella
    if (this.commessePromise) {
      return this.commessePromise;
    }

    // Fai la chiamata e salva in cache
    this.commessePromise = this.request(endpoint)
      .then(data => {
        // Gestisci sia array che oggetto paginato
        const result = Array.isArray(data) ? data : (data.data || data);
        this.commesseCache.data = result;
        this.commesseCache.timestamp = now;
        this.commesseCache.filters = filtersKey;
        this.commessePromise = null;
        return result;
      })
      .catch(err => {
        this.commessePromise = null;
        throw err;
      });

    return this.commessePromise;
  }

  async getCommesseYearFolders(clienteId) {
    if (!clienteId) return [];
    const params = new URLSearchParams();
    params.append('clienteId', clienteId);
    return this.request(`/commesse/cartelle-anni?${params.toString()}`);
  }

  async createCommessaYearFolder(clienteId, anno) {
    return this.request('/commesse/cartelle-anni', {
      method: 'POST',
      body: {
        cliente_id: clienteId,
        anno
      }
    });
  }

  async createCommessa(payload) {
    const result = await this.request('/commesse', {
      method: 'POST',
      body: payload,
    });
    // Invalida cache commesse dopo creazione
    this.clearCommesseCache();
    return result;
  }

  async updateCommessa(id, payload) {
    const result = await this.request(`/commesse/${id}`, {
      method: 'PUT',
      body: payload,
    });
    // Invalida cache commesse dopo aggiornamento
    this.clearCommesseCache();
    return result;
  }

  async deleteCommessa(id) {
    const result = await this.request(`/commesse/${id}`, {
      method: 'DELETE',
    });
    // Invalida cache commesse dopo eliminazione
    this.clearCommesseCache();
    return result;
  }

  async getCommessaAllegati(id) {
    return this.request(`/commesse/${id}/allegati`);
  }

  async getCommessaAudit(id) {
    return this.request(`/commesse/${id}/audit`);
  }

  async addCommessaAuditNote(id, payload) {
    return this.request(`/commesse/${id}/audit`, {
      method: 'POST',
      body: payload,
    });
  }

  async uploadCommessaAllegato(id, file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.requestForm(`/commesse/${id}/allegati`, formData);
  }

  async deleteCommessaAllegato(allegatoId) {
    return this.request(`/commesse/allegati/${allegatoId}`, {
      method: 'DELETE',
    });
  }

  // Tracking ore commesse
  async getTrackingActive() {
    return this.request('/tracking/active');
  }

  async getCommessaTrackingEntries(commessaId) {
    return this.request(`/tracking/commesse/${commessaId}/entries`);
  }

  async startTracking(commessaId) {
    return this.request('/tracking/start', {
      method: 'POST',
      body: { commessa_id: commessaId },
    });
  }

  async stopTracking(entryId) {
    return this.request(`/tracking/entries/${entryId}/stop`, {
      method: 'PUT',
    });
  }

  async addTrackingManual(commessaId, data, ore, note) {
    return this.request('/tracking/manual', {
      method: 'POST',
      body: {
        commessa_id: commessaId,
        data,
        ore,
        note
      },
    });
  }

  // Clienti API
  async getClienti(search = '', forceRefresh = false) {
    const endpoint = search ? `/clienti?search=${encodeURIComponent(search)}` : '/clienti';
    
    // Usa cache se disponibile, non scaduta e con la stessa ricerca
    const now = Date.now();
    if (!forceRefresh && this.clientiCache.data && this.clientiCache.timestamp && 
        this.clientiCache.search === search &&
        (now - this.clientiCache.timestamp) < this.clientiCache.ttl) {
      return Promise.resolve(this.clientiCache.data);
    }

    // Se c'è già una chiamata in corso per questa ricerca, aspetta quella
    if (this.clientiPromise) {
      return this.clientiPromise;
    }

    // Fai la chiamata e salva in cache
    this.clientiPromise = this.request(endpoint)
      .then(data => {
        // Gestisci sia array che oggetto paginato
        const result = Array.isArray(data) ? data : (data.data || data);
        this.clientiCache.data = result;
        this.clientiCache.timestamp = now;
        this.clientiCache.search = search;
        this.clientiPromise = null;
        return result;
      })
      .catch(err => {
        this.clientiPromise = null;
        throw err;
      });

    return this.clientiPromise;
  }

  async getCliente(id) {
    return this.request(`/clienti/${id}`);
  }

  async createCliente(cliente) {
    const result = await this.request('/clienti', {
      method: 'POST',
      body: cliente,
    });
    // Invalida cache clienti dopo creazione
    this.clearClientiCache();
    return result;
  }

  async updateCliente(id, cliente) {
    const result = await this.request(`/clienti/${id}`, {
      method: 'PUT',
      body: cliente,
    });
    // Invalida cache clienti dopo aggiornamento
    this.clearClientiCache();
    return result;
  }

  async deleteCliente(id) {
    const result = await this.request(`/clienti/${id}`, {
      method: 'DELETE',
    });
    // Invalida cache clienti dopo eliminazione
    this.clearClientiCache();
    return result;
  }

  // Contatti API
  async getClienteContatti(clienteId) {
    return this.request(`/clienti/${clienteId}/contatti`);
  }

  async createClienteContatto(clienteId, contatto) {
    return this.request(`/clienti/${clienteId}/contatti`, {
      method: 'POST',
      body: contatto,
    });
  }

  async updateClienteContatto(clienteId, contattoId, contatto) {
    return this.request(`/clienti/${clienteId}/contatti/${contattoId}`, {
      method: 'PUT',
      body: contatto,
    });
  }

  async deleteClienteContatto(clienteId, contattoId) {
    return this.request(`/clienti/${clienteId}/contatti/${contattoId}`, {
      method: 'DELETE',
    });
  }

  // Attività API
  async getAttivita(filters = {}, forceRefresh = false) {
    const params = new URLSearchParams();
    if (filters.filter) params.append('filter', filters.filter);
    if (filters.month) params.append('month', filters.month);
    if (filters.quarter) params.append('quarter', filters.quarter);
    if (filters.year) params.append('year', filters.year);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.userId) params.append('userId', filters.userId);
    
    // Aggiungi timestamp per evitare cache del browser quando forceRefresh è true
    if (forceRefresh) {
      params.append('_t', Date.now().toString());
    }

    const query = params.toString();
    const endpoint = query ? `/attivita?${query}` : '/attivita';
    return this.request(endpoint);
  }

  async getAttivitaById(id) {
    return this.request(`/attivita/${id}`);
  }

  async getTotals(startDate, endDate) {
    return this.request(`/attivita/totals?startDate=${startDate}&endDate=${endDate}`);
  }

  async createAttivita(attivita) {
    return this.request('/attivita', {
      method: 'POST',
      body: attivita,
    });
  }

  async updateAttivita(id, attivita) {
    return this.request(`/attivita/${id}`, {
      method: 'PUT',
      body: attivita,
    });
  }

  async deleteAttivita(id) {
    return this.request(`/attivita/${id}`, {
      method: 'DELETE',
    });
  }

  // Note Spese API
  async getNoteSpese(filters = {}) {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.categoria) params.append('categoria', filters.categoria);
    if (filters.stato) params.append('stato', filters.stato);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    const query = params.toString();
    const endpoint = query ? `/note-spese?${query}` : '/note-spese';
    return this.request(endpoint);
  }

  async createNotaSpesa(payload) {
    return this.request('/note-spese', {
      method: 'POST',
      body: payload,
    });
  }

  async updateNotaSpesa(id, payload) {
    return this.request(`/note-spese/${id}`, {
      method: 'PUT',
      body: payload,
    });
  }

  async deleteNotaSpesa(id) {
    return this.request(`/note-spese/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadNotaSpesaAllegato(id, file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.requestForm(`/note-spese/${id}/allegato`, formData);
  }

  // Impostazioni API
  async getDatiAziendali() {
    return this.request('/impostazioni/dati-aziendali');
  }

  async updateDatiAziendali(payload) {
    return this.request('/impostazioni/dati-aziendali', {
      method: 'PUT',
      body: payload,
    });
  }

  async getDatiFiscali() {
    return this.request('/impostazioni/dati-fiscali');
  }

  async updateDatiFiscali(payload) {
    return this.request('/impostazioni/dati-fiscali', {
      method: 'PUT',
      body: payload,
    });
  }

  // Kanban API
  // Colonne
  async getKanbanColonne() {
    return this.request('/kanban/colonne');
  }

  async createKanbanColonna(colonna) {
    return this.request('/kanban/colonne', {
      method: 'POST',
      body: colonna,
    });
  }

  async updateKanbanColonna(id, colonna) {
    return this.request(`/kanban/colonne/${id}`, {
      method: 'PUT',
      body: colonna,
    });
  }

  async deleteKanbanColonna(id) {
    return this.request(`/kanban/colonne/${id}`, {
      method: 'DELETE',
    });
  }

  // Card
  async getKanbanCard(filters = {}) {
    const params = new URLSearchParams();
    if (filters.colonna_id) params.append('colonna_id', filters.colonna_id);
    if (filters.cliente_id) params.append('cliente_id', filters.cliente_id);
    if (filters.responsabile_id) params.append('responsabile_id', filters.responsabile_id);
    if (filters.priorita) params.append('priorita', filters.priorita);
    if (filters.ricerca) params.append('ricerca', filters.ricerca);
    if (filters.data_inizio_da) params.append('data_inizio_da', filters.data_inizio_da);
    if (filters.data_inizio_a) params.append('data_inizio_a', filters.data_inizio_a);
    if (filters.data_fine_da) params.append('data_fine_da', filters.data_fine_da);
    if (filters.data_fine_a) params.append('data_fine_a', filters.data_fine_a);
    if (filters.tags) params.append('tags', filters.tags);
    const query = params.toString();
    const endpoint = query ? `/kanban/card?${query}` : '/kanban/card';
    return this.request(endpoint);
  }

  async getKanbanCardById(id) {
    return this.request(`/kanban/card/${id}`);
  }

  async createKanbanCard(card) {
    return this.request('/kanban/card', {
      method: 'POST',
      body: card,
    });
  }

  async updateKanbanCard(id, card) {
    return this.request(`/kanban/card/${id}`, {
      method: 'PUT',
      body: card,
    });
  }

  async moveKanbanCard(id, colonna_id, ordine) {
    return this.request(`/kanban/card/${id}/move`, {
      method: 'PUT',
      body: { colonna_id, ordine },
    });
  }

  async deleteKanbanCard(id) {
    return this.request(`/kanban/card/${id}`, {
      method: 'DELETE',
    });
  }

  // Scadenze
  async getKanbanScadenze(cardId) {
    return this.request(`/kanban/card/${cardId}/scadenze`);
  }

  async createKanbanScadenza(cardId, scadenza) {
    return this.request(`/kanban/card/${cardId}/scadenze`, {
      method: 'POST',
      body: scadenza,
    });
  }

  async updateKanbanScadenza(id, scadenza) {
    return this.request(`/kanban/scadenze/${id}`, {
      method: 'PUT',
      body: scadenza,
    });
  }

  async completeKanbanScadenza(id) {
    return this.request(`/kanban/scadenze/${id}/complete`, {
      method: 'PUT',
    });
  }

  async deleteKanbanScadenza(id) {
    return this.request(`/kanban/scadenze/${id}`, {
      method: 'DELETE',
    });
  }

  // Notifiche
  async getKanbanNotifiche(unread = false) {
    const endpoint = unread ? '/kanban/notifiche?unread=true' : '/kanban/notifiche';
    return this.request(endpoint);
  }

  async getKanbanUnreadCount() {
    return this.request('/kanban/notifiche/unread-count');
  }

  async markKanbanNotificaAsRead(id) {
    return this.request(`/kanban/notifiche/${id}/read`, {
      method: 'PUT',
    });
  }

  async markAllKanbanNotificheAsRead() {
    return this.request('/kanban/notifiche/read-all', {
      method: 'PUT',
    });
  }

  // Commenti
  async getKanbanCommenti(cardId) {
    return this.request(`/kanban/card/${cardId}/commenti`);
  }

  async createKanbanCommento(cardId, commento) {
    return this.request(`/kanban/card/${cardId}/commenti`, {
      method: 'POST',
      body: { commento },
    });
  }

  async updateKanbanCommento(id, commento) {
    return this.request(`/kanban/commenti/${id}`, {
      method: 'PUT',
      body: { commento },
    });
  }

  async deleteKanbanCommento(id) {
    return this.request(`/kanban/commenti/${id}`, {
      method: 'DELETE',
    });
  }
}

export default new ApiService();
