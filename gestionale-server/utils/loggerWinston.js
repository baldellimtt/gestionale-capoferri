/**
 * Logger strutturato con Winston
 * - Log rotation automatico (giornaliero)
 * - Log strutturato JSON
 * - Log level configurabile da variabile d'ambiente
 * - Mantiene compatibilità con Logger esistente
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Configurazione da variabili d'ambiente
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_MAX_SIZE = process.env.LOG_MAX_SIZE || '20m';
const LOG_MAX_FILES = process.env.LOG_MAX_FILES || '14d'; // Mantieni 14 giorni di log
const LOG_DATE_PATTERN = process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD';

// Valida log level
const validLevels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];
const finalLogLevel = validLevels.includes(LOG_LEVEL.toLowerCase()) 
  ? LOG_LEVEL.toLowerCase() 
  : 'info';

// Crea directory logs se non esiste
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Formato JSON strutturato completo
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json({
    space: 0,
    replacer: (key, value) => {
      // Escludi campi interni di Winston dal JSON
      if (key === 'level' || key === 'message' || key === 'timestamp' || key === 'service') {
        return value;
      }
      // Gestisci errori con stack trace
      if (value instanceof Error) {
        return {
          message: value.message,
          stack: value.stack,
          name: value.name,
          ...(value.code && { code: value.code })
        };
      }
      return value;
    }
  })
);

// Formato console (più leggibile per development)
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    let msg = `${timestamp} [${level}]`;
    if (service) {
      msg += ` [${service}]`;
    }
    msg += `: ${message}`;
    
    // Aggiungi metadati se presenti
    const metaKeys = Object.keys(meta);
    if (metaKeys.length > 0) {
      // Rimuovi campi interni di Winston
      const cleanMeta = {};
      metaKeys.forEach(key => {
        if (!['timestamp', 'level', 'message', 'service', 'splat', 'Symbol(level)', 'Symbol(message)'].includes(key)) {
          cleanMeta[key] = meta[key];
        }
      });
      
      if (Object.keys(cleanMeta).length > 0) {
        msg += ` ${JSON.stringify(cleanMeta, null, 2)}`;
      }
    }
    return msg;
  })
);

// Configurazione rotazione file per errori
const errorRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: LOG_DATE_PATTERN,
  level: 'error',
  format: jsonFormat,
  maxSize: LOG_MAX_SIZE,
  maxFiles: LOG_MAX_FILES,
  zippedArchive: true, // Comprimi file vecchi
  auditFile: path.join(LOG_DIR, '.audit-error.json'),
  createSymlink: true,
  symlinkName: 'error-current.log'
});

// Configurazione rotazione file per tutti i log
const combinedRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
  datePattern: LOG_DATE_PATTERN,
  format: jsonFormat,
  maxSize: LOG_MAX_SIZE,
  maxFiles: LOG_MAX_FILES,
  zippedArchive: true, // Comprimi file vecchi
  auditFile: path.join(LOG_DIR, '.audit-combined.json'),
  createSymlink: true,
  symlinkName: 'combined-current.log'
});

// Configurazione rotazione per eccezioni non gestite
const exceptionRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'exceptions-%DATE%.log'),
  datePattern: LOG_DATE_PATTERN,
  format: jsonFormat,
  maxSize: LOG_MAX_SIZE,
  maxFiles: LOG_MAX_FILES,
  zippedArchive: true,
  auditFile: path.join(LOG_DIR, '.audit-exceptions.json'),
  createSymlink: true,
  symlinkName: 'exceptions-current.log'
});

// Configurazione rotazione per promise rejection
const rejectionRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'rejections-%DATE%.log'),
  datePattern: LOG_DATE_PATTERN,
  format: jsonFormat,
  maxSize: LOG_MAX_SIZE,
  maxFiles: LOG_MAX_FILES,
  zippedArchive: true,
  auditFile: path.join(LOG_DIR, '.audit-rejections.json'),
  createSymlink: true,
  symlinkName: 'rejections-current.log'
});

// Crea logger Winston
const winstonLogger = winston.createLogger({
  level: finalLogLevel,
  format: jsonFormat,
  defaultMeta: { 
    service: 'gestionale-server',
    environment: NODE_ENV,
    pid: process.pid
  },
  transports: [
    errorRotateTransport,
    combinedRotateTransport
  ],
  // Gestione eccezioni non gestite
  exceptionHandlers: NODE_ENV === 'production' 
    ? [exceptionRotateTransport]
    : [
        exceptionRotateTransport,
        new winston.transports.Console({
          format: consoleFormat
        })
      ],
  // Gestione promise rejection
  rejectionHandlers: NODE_ENV === 'production'
    ? [rejectionRotateTransport]
    : [
        rejectionRotateTransport,
        new winston.transports.Console({
          format: consoleFormat
        })
      ],
  // Non uscire su errori
  exitOnError: false
});

// In development, logga anche su console con formato leggibile
if (NODE_ENV !== 'production') {
  winstonLogger.add(new winston.transports.Console({
    format: consoleFormat,
    level: finalLogLevel
  }));
} else {
  // In production, console solo per errori critici
  winstonLogger.add(new winston.transports.Console({
    format: jsonFormat,
    level: 'error'
  }));
}

// Gestione eventi rotazione
errorRotateTransport.on('rotate', (oldFilename, newFilename) => {
  winstonLogger.info('Rotazione log errori', { oldFilename, newFilename });
});

combinedRotateTransport.on('rotate', (oldFilename, newFilename) => {
  winstonLogger.info('Rotazione log combined', { oldFilename, newFilename });
});

// Wrapper per mantenere compatibilità con Logger esistente
// Esteso con supporto per metadati strutturati
class Logger {
  /**
   * Log generico con livello personalizzato
   * @param {string} level - Livello di log (error, warn, info, debug, etc.)
   * @param {string} message - Messaggio di log
   * @param {object|null} data - Dati aggiuntivi da loggare
   * @param {object} meta - Metadati aggiuntivi (requestId, userId, etc.)
   */
  static log(level, message, data = null, meta = {}) {
    const logMeta = {
      ...meta,
      ...(data && { data })
    };
    winstonLogger.log(level, message, logMeta);
  }

  /**
   * Log informativo
   * @param {string} message - Messaggio
   * @param {object|null} data - Dati aggiuntivi
   * @param {object} meta - Metadati aggiuntivi
   */
  static info(message, data = null, meta = {}) {
    this.log('info', message, data, meta);
  }

  /**
   * Log di errore
   * @param {string} message - Messaggio
   * @param {Error|object|null} data - Errore o dati aggiuntivi
   * @param {object} meta - Metadati aggiuntivi
   */
  static error(message, data = null, meta = {}) {
    // Se data è un Error, estrai informazioni
    if (data instanceof Error) {
      const errorMeta = {
        ...meta,
        error: {
          message: data.message,
          stack: data.stack,
          name: data.name,
          ...(data.code && { code: data.code })
        }
      };
      winstonLogger.error(message, errorMeta);
    } else {
      this.log('error', message, data, meta);
    }
  }

  /**
   * Log di warning
   * @param {string} message - Messaggio
   * @param {object|null} data - Dati aggiuntivi
   * @param {object} meta - Metadati aggiuntivi
   */
  static warn(message, data = null, meta = {}) {
    this.log('warn', message, data, meta);
  }

  /**
   * Log di debug
   * @param {string} message - Messaggio
   * @param {object|null} data - Dati aggiuntivi
   * @param {object} meta - Metadati aggiuntivi
   */
  static debug(message, data = null, meta = {}) {
    this.log('debug', message, data, meta);
  }

  /**
   * Log verbose (dettagliato)
   * @param {string} message - Messaggio
   * @param {object|null} data - Dati aggiuntivi
   * @param {object} meta - Metadati aggiuntivi
   */
  static verbose(message, data = null, meta = {}) {
    this.log('verbose', message, data, meta);
  }

  /**
   * Crea un child logger con metadati predefiniti
   * Utile per aggiungere context (es. requestId, userId) a tutti i log di una richiesta
   * @param {object} defaultMeta - Metadati da aggiungere a tutti i log
   * @returns {object} Logger con metadati predefiniti
   */
  static child(defaultMeta = {}) {
    return {
      log: (level, message, data = null, meta = {}) => {
        Logger.log(level, message, data, { ...defaultMeta, ...meta });
      },
      info: (message, data = null, meta = {}) => {
        Logger.info(message, data, { ...defaultMeta, ...meta });
      },
      error: (message, data = null, meta = {}) => {
        Logger.error(message, data, { ...defaultMeta, ...meta });
      },
      warn: (message, data = null, meta = {}) => {
        Logger.warn(message, data, { ...defaultMeta, ...meta });
      },
      debug: (message, data = null, meta = {}) => {
        Logger.debug(message, data, { ...defaultMeta, ...meta });
      },
      verbose: (message, data = null, meta = {}) => {
        Logger.verbose(message, data, { ...defaultMeta, ...meta });
      }
    };
  }
}

module.exports = Logger;


