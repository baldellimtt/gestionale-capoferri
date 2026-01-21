/**
 * Error Handler Centralizzato
 * Incrementale, non distruttivo
 */

const Logger = require('./logger');

class ErrorHandler {
  /**
   * Gestisce errori e nasconde dettagli in produzione
   */
  static handle(error, req, res, next) {
    // Log errore completo
    Logger.error('Errore API', {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      path: req.path,
      method: req.method,
      user: req.user?.username || 'anonymous'
    });

    // Determina status code
    let statusCode = error.statusCode || error.status || 500;
    let message = error.message || 'Errore interno del server';

    // Errori di validazione
    if (error.name === 'ValidationError') {
      statusCode = 400;
      message = error.message;
    }

    // Errori di autenticazione
    if (error.name === 'UnauthorizedError' || statusCode === 401) {
      statusCode = 401;
      message = 'Autenticazione richiesta';
    }

    // Errori di autorizzazione
    if (statusCode === 403) {
      message = 'Permesso negato';
    }

    // In produzione, nascondi dettagli errori interni
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
      message = 'Errore interno del server';
    }

    res.status(statusCode).json({
      error: message,
      ...(process.env.NODE_ENV === 'development' && {
        details: error.details,
        stack: error.stack
      })
    });
  }

  /**
   * Crea errore custom
   */
  static createError(message, statusCode = 400, details = null) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.status = statusCode;
    if (details) error.details = details;
    return error;
  }

  /**
   * Wrapper per async route handlers
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

module.exports = ErrorHandler;




