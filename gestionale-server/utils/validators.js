/**
 * Validators per input sanitization e validazione
 * Incrementale, non distruttivo
 */

class Validators {
  /**
   * Sanitizza stringa rimuovendo caratteri pericolosi
   */
  static sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str
      .trim()
      .replace(/[<>]/g, '') // Rimuove < e > per prevenire XSS base
      .substring(0, 1000); // Limite lunghezza
  }

  /**
   * Valida email formato base
   */
  static isValidEmail(email) {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  /**
   * Valida telefono italiano (formato flessibile)
   */
  static isValidPhone(phone) {
    if (!phone) return false;
    // Rimuove spazi, trattini, parentesi
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    // Accetta numeri con o senza prefisso +39
    return /^(\+39)?[0-9]{8,12}$/.test(cleaned);
  }

  /**
   * Valida Partita IVA italiana
   */
  static isValidPartitaIva(piva) {
    if (!piva) return false;
    const cleaned = piva.replace(/\s/g, '');
    // Partita IVA italiana: 11 cifre
    if (!/^\d{11}$/.test(cleaned)) return false;
    
    // Algoritmo di validazione Luhn-like per P.IVA
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      let digit = parseInt(cleaned[i]);
      if (i % 2 === 1) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(cleaned[10]);
  }

  /**
   * Valida Codice Fiscale italiano (formato base)
   */
  static isValidCodiceFiscale(cf) {
    if (!cf) return false;
    const cleaned = cf.replace(/\s/g, '').toUpperCase();
    // CF: 16 caratteri alfanumerici
    return /^[A-Z0-9]{16}$/.test(cleaned);
  }

  /**
   * Valida CAP italiano (5 cifre)
   */
  static isValidCap(cap) {
    if (!cap) return false;
    const cleaned = cap.replace(/\s/g, '');
    return /^\d{5}$/.test(cleaned);
  }

  /**
   * Valida data formato YYYY-MM-DD
   */
  static isValidDate(dateString) {
    if (!dateString) return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  /**
   * Valida ID numerico
   */
  static isValidId(id) {
    if (id === null || id === undefined) return false;
    const numId = parseInt(id, 10);
    return !isNaN(numId) && numId > 0 && Number.isFinite(numId);
  }

  /**
   * Valida numero positivo
   */
  static isValidPositiveNumber(value, allowZero = true) {
    if (value === null || value === undefined) return false;
    const num = parseFloat(value);
    return !isNaN(num) && Number.isFinite(num) && (allowZero ? num >= 0 : num > 0);
  }

  /**
   * Sanitizza oggetto ricorsivamente
   */
  static sanitizeObject(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return this.sanitizeString(String(obj));
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}

module.exports = Validators;




