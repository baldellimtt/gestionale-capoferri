/**
 * Password Policy Validator
 * Incrementale, non distruttivo
 */

class PasswordPolicy {
  constructor(options = {}) {
    this.minLength = options.minLength || 8;
    this.requireUppercase = options.requireUppercase !== false;
    this.requireLowercase = options.requireLowercase !== false;
    this.requireNumbers = options.requireNumbers !== false;
    this.requireSpecialChars = options.requireSpecialChars || false;
    this.maxLength = options.maxLength || 128;
  }

  /**
   * Valida password secondo policy
   */
  validate(password) {
    const errors = [];

    if (!password || typeof password !== 'string') {
      return { valid: false, errors: ['Password obbligatoria'] };
    }

    if (password.length < this.minLength) {
      errors.push(`Password deve essere di almeno ${this.minLength} caratteri`);
    }

    if (password.length > this.maxLength) {
      errors.push(`Password non può superare ${this.maxLength} caratteri`);
    }

    if (this.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password deve contenere almeno una lettera maiuscola');
    }

    if (this.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password deve contenere almeno una lettera minuscola');
    }

    if (this.requireNumbers && !/\d/.test(password)) {
      errors.push('Password deve contenere almeno un numero');
    }

    if (this.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password deve contenere almeno un carattere speciale');
    }

    // Controlla password comuni (lista base)
    const commonPasswords = [
      'password', '12345678', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890'
    ];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password troppo comune, scegli una password più sicura');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Genera suggerimenti per password più sicura
   */
  getSuggestions() {
    const suggestions = [];
    if (this.requireUppercase) suggestions.push('Aggiungi lettere maiuscole');
    if (this.requireLowercase) suggestions.push('Aggiungi lettere minuscole');
    if (this.requireNumbers) suggestions.push('Aggiungi numeri');
    if (this.requireSpecialChars) suggestions.push('Aggiungi caratteri speciali (!@#$%...)');
    return suggestions;
  }
}

// Default policy (configurabile via env)
const defaultPolicy = new PasswordPolicy({
  minLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
  requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
  requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
  requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
  requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL === 'true'
});

module.exports = {
  PasswordPolicy,
  defaultPolicy
};



