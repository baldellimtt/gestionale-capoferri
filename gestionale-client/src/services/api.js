const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
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
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
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

