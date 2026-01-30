const https = require('https');
const { URL } = require('url');

class FattureInCloudApi {
  constructor() {
    this.baseUrl = process.env.FATTURE_IN_CLOUD_API_BASE || 'https://api-v2.fattureincloud.it';
    this.token = process.env.FATTURE_IN_CLOUD_API_TOKEN || '';
    this.companyId = process.env.FATTURE_IN_CLOUD_COMPANY_ID || '';
  }

  isConfigured() {
    return Boolean(this.token);
  }

  async getCompanyId() {
    if (this.companyId) {
      return this.companyId;
    }
    const response = await this.requestJson('GET', '/user/companies');
    const data = response?.data || response?.companies || response?.items || response || {};
    const companies = Array.isArray(data)
      ? data
      : (data.companies || data.data || data.items || []);
    if (!companies.length) {
      return '';
    }
    const company = companies[0] || {};
    this.companyId = String(company.id || company.company_id || '');
    return this.companyId;
  }

  async requestJson(method, pathname, body = null) {
    if (!this.token) {
      const error = new Error('Token Fatture in Cloud mancante');
      error.status = 401;
      throw error;
    }

    const url = new URL(pathname, this.baseUrl);
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json'
    };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const options = { method, headers };

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            const error = new Error(`HTTP ${res.statusCode}: ${data}`);
            error.status = res.statusCode;
            error.payload = data;
            return reject(error);
          }
          if (!data) {
            return resolve({});
          }
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            err.payload = data;
            reject(err);
          }
        });
      });

      req.on('error', reject);
      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }
}

module.exports = FattureInCloudApi;
