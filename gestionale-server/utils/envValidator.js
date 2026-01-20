/**
 * Validatore per variabili d'ambiente
 * Verifica che tutte le variabili obbligatorie siano presenti all'avvio
 */

class EnvValidator {
  constructor() {
    this.errors = []
    this.warnings = []
  }

  /**
   * Valida una variabile d'ambiente
   * @param {string} key - Nome della variabile
   * @param {object} options - Opzioni di validazione
   * @param {boolean} options.required - Se la variabile è obbligatoria
   * @param {*} options.default - Valore di default se non presente
   * @param {function} options.validator - Funzione di validazione personalizzata
   * @param {string} options.description - Descrizione della variabile
   */
  validate(key, options = {}) {
    const {
      required = false,
      default: defaultValue = null,
      validator = null,
      description = ''
    } = options

    const value = process.env[key]

    // Se non presente e non obbligatoria, usa il default
    if (!value && !required) {
      if (defaultValue !== null) {
        process.env[key] = defaultValue
      }
      return defaultValue
    }

    // Se obbligatoria e non presente
    if (required && !value) {
      this.errors.push(
        `❌ Variabile d'ambiente obbligatoria mancante: ${key}${description ? ` (${description})` : ''}`
      )
      return null
    }

    // Validazione personalizzata
    if (validator && typeof validator === 'function') {
      try {
        const isValid = validator(value)
        if (!isValid) {
          this.errors.push(
            `❌ Valore non valido per ${key}: ${value}${description ? ` (${description})` : ''}`
          )
          return null
        }
      } catch (error) {
        this.errors.push(
          `❌ Errore validazione ${key}: ${error.message}`
        )
        return null
      }
    }

    return value
  }

  /**
   * Aggiunge un warning
   */
  warn(message) {
    this.warnings.push(`⚠️  ${message}`)
  }

  /**
   * Valida tutte le variabili e lancia errore se necessario
   */
  validateAll() {
    if (this.errors.length > 0) {
      console.error('\n❌ ERRORE: Variabili d\'ambiente mancanti o non valide:\n')
      this.errors.forEach(error => console.error(`  ${error}`))
      console.error('\n💡 Crea un file .env basato su .env.example e configura le variabili richieste.\n')
      process.exit(1)
    }

    if (this.warnings.length > 0) {
      console.warn('\n⚠️  WARNING: Configurazioni consigliate:\n')
      this.warnings.forEach(warning => console.warn(`  ${warning}`))
      console.warn('')
    }
  }

  /**
   * Valida configurazione completa per il server
   */
  validateServerConfig() {
    const NODE_ENV = this.validate('NODE_ENV', {
      required: false,
      default: 'development',
      validator: (val) => ['development', 'production', 'test'].includes(val),
      description: 'Ambiente di esecuzione (development|production|test)'
    })

    // Port
    this.validate('PORT', {
      required: false,
      default: '3001',
      validator: (val) => {
        const port = parseInt(val, 10)
        return !isNaN(port) && port > 0 && port < 65536
      },
      description: 'Porta del server (1-65535)'
    })

    // Database path
    this.validate('DB_PATH', {
      required: false,
      default: null, // Verrà gestito in server.js
      description: 'Percorso del database SQLite'
    })

    // JWT Secret (obbligatorio in produzione)
    const isProduction = NODE_ENV === 'production'
    this.validate('JWT_SECRET', {
      required: isProduction,
      default: isProduction ? null : 'dev-secret-change-in-production',
      validator: (val) => val && val.length >= 32,
      description: 'Secret per JWT (minimo 32 caratteri, obbligatorio in produzione)'
    })

    // JWT Expiration
    this.validate('JWT_EXPIRATION', {
      required: false,
      default: '15m',
      description: 'Durata token JWT (es: 15m, 1h, 7d)'
    })

    // Refresh Token Expiration
    this.validate('JWT_REFRESH_EXPIRATION', {
      required: false,
      default: '7d',
      description: 'Durata refresh token JWT'
    })

    // CORS Origin (obbligatorio in produzione)
    if (isProduction) {
      this.validate('CORS_ORIGIN', {
        required: true,
        description: 'Origine CORS consentita (es: https://example.com)'
      })
    } else {
      this.validate('CORS_ORIGIN', {
        required: false,
        default: '*',
        description: 'Origine CORS consentita'
      })
    }

    // Rate Limiting
    this.validate('RATE_LIMIT_WINDOW_MS', {
      required: false,
      default: '900000', // 15 minuti
      validator: (val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Finestra temporale rate limiting in millisecondi'
    })

    this.validate('RATE_LIMIT_MAX_REQUESTS', {
      required: false,
      default: isProduction ? '100' : '1000',
      validator: (val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Numero massimo richieste per finestra temporale'
    })

    // Logging
    this.validate('LOG_LEVEL', {
      required: false,
      default: isProduction ? 'info' : 'debug',
      validator: (val) => ['error', 'warn', 'info', 'debug'].includes(val),
      description: 'Livello di logging (error|warn|info|debug)'
    })

    this.validate('LOG_DIR', {
      required: false,
      default: './logs',
      description: 'Directory per i file di log'
    })

    // Backup
    this.validate('BACKUP_ENABLED', {
      required: false,
      default: 'true',
      validator: (val) => ['true', 'false'].includes(val.toLowerCase()),
      description: 'Abilita backup automatico (true|false)'
    })

    this.validate('BACKUP_INTERVAL_HOURS', {
      required: false,
      default: '24',
      validator: (val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Intervallo backup automatico in ore'
    })

    this.validate('BACKUP_DIR', {
      required: false,
      default: './backups',
      description: 'Directory per i backup'
    })

    // File Upload
    this.validate('UPLOAD_MAX_SIZE_MB', {
      required: false,
      default: '10',
      validator: (val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Dimensione massima file upload in MB'
    })

    this.validate('UPLOAD_DIR', {
      required: false,
      default: './uploads',
      description: 'Directory per i file caricati'
    })

    // Warnings per produzione
    if (isProduction) {
      if (process.env.JWT_SECRET === 'dev-secret-change-in-production') {
        this.warn('JWT_SECRET usa il valore di default. Cambialo in produzione!')
      }
      if (process.env.CORS_ORIGIN === '*') {
        this.warn('CORS_ORIGIN è impostato su "*". Configura un dominio specifico in produzione!')
      }
    }

    this.validateAll()
  }
}

module.exports = new EnvValidator()



