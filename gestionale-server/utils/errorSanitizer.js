/**
 * Utility per sanitizzare messaggi di errore
 */
const ErrorHandler = require('./errorHandler');

/**
 * Wrapper per gestire errori in route handlers
 */
function handleError(res, error, defaultMessage = 'Errore interno del server') {
  const statusCode = error.statusCode || error.status || 500;
  const message = statusCode === 500 
    ? ErrorHandler.sanitizeErrorMessage(error)
    : (error.message || defaultMessage);
  
  res.status(statusCode).json({ error: message });
}

module.exports = { handleError };



