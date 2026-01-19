const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const TOKEN_STORAGE_KEY = 'gestionale_auth_token';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem(TOKEN_STORAGE_KEY) || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }

  getToken() {
    return this.token;
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

      if (!response.ok) {
        const error = new Error(data.error || `HTTP error! status: ${response.status}`);
        error.status = response.status;
        throw error;
      }

      // Per DELETE, se non c'? data, restituisci success: true
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

    if (data.token) {
      this.setToken(data.token);
    }

    return data;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async me() {
    return this.request('/auth/me');
  }

  async updateMe(payload) {
    return this.request('/auth/me', {
      method: 'PUT',
      body: payload,
    });
  }

  // Utenti API (admin)
  async getUtenti() {
    return this.request('/utenti');
  }

  async createUtente(payload) {
    return this.request('/utenti', {
      method: 'POST',
      body: payload,
    });
  }

  async updateUtente(id, payload) {
    return this.request(`/utenti/${id}`, {
      method: 'PUT',
      body: payload,
    });
  }

  async deleteUtente(id) {
    return this.request(`/utenti/${id}`, {
      method: 'DELETE',
    });
  }

  // Commesse API
  async getCommesse(filters = {}) {
    const params = new URLSearchParams();
    if (filters.clienteId) params.append('clienteId', filters.clienteId);
    if (filters.stato) params.append('stato', filters.stato);
    if (filters.statoPagamenti) params.append('statoPagamenti', filters.statoPagamenti);
    const query = params.toString();
    const endpoint = query ? `/commesse?${query}` : '/commesse';
    return this.request(endpoint);
  }

  async createCommessa(payload) {
    return this.request('/commesse', {
      method: 'POST',
      body: payload,
    });
  }

  async updateCommessa(id, payload) {
    return this.request(`/commesse/${id}`, {
      method: 'PUT',
      body: payload,
    });
  }

  async deleteCommessa(id) {
    return this.request(`/commesse/${id}`, {
      method: 'DELETE',
    });
  }

  async getCommessaAllegati(id) {
    return this.request(`/commesse/${id}/allegati`);
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

  // Clienti API
  async getClienti(search = '') {
    const endpoint = search ? `/clienti?search=${encodeURIComponent(search)}` : '/clienti';
    return this.request(endpoint);
  }

  async getCliente(id) {
    return this.request(`/clienti/${id}`);
  }

  async createCliente(cliente) {
    return this.request('/clienti', {
      method: 'POST',
      body: cliente,
    });
  }

  async updateCliente(id, cliente) {
    return this.request(`/clienti/${id}`, {
      method: 'PUT',
      body: cliente,
    });
  }

  async deleteCliente(id) {
    return this.request(`/clienti/${id}`, {
      method: 'DELETE',
    });
  }

  // Attività API
  async getAttivita(filters = {}) {
    const params = new URLSearchParams();
    if (filters.filter) params.append('filter', filters.filter);
    if (filters.month) params.append('month', filters.month);
    if (filters.quarter) params.append('quarter', filters.quarter);
    if (filters.year) params.append('year', filters.year);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

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
}

export default new ApiService();
