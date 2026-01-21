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
   * Valida email con controllo di lunghezza
   */
  static isValidEmail(email) {
    if (!email) return false;
    return String(email).trim().length <= 255;
  }

  /**
   * Valida telefono con controllo di lunghezza
   */
  static isValidPhone(phone) {
    if (!phone) return false;
    return String(phone).trim().length <= 25;
  }

  /**
   * Valida Partita IVA con controllo di lunghezza
   */
  static isValidPartitaIva(piva) {
    if (!piva) return false;
    return piva.replace(/\s/g, '').length <= 20;
  }

  /**
   * Valida CAP con controllo di lunghezza
   */
  static isValidCap(cap) {
    if (!cap) return false;
    return cap.replace(/\s/g, '').length <= 10;
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




