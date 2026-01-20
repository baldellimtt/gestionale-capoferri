/**
 * Middleware per validazione express-validator
 * Incrementale, non distruttivo
 */

const { validationResult } = require('express-validator');
const ErrorHandler = require('./errorHandler');

/**
 * Middleware per validare i risultati della validazione
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value
    }));

    return res.status(400).json({
      error: 'Errore di validazione',
      details: errorMessages
    });
  }
  next();
};

/**
 * Wrapper per combinare validators e validate
 */
const validateRequest = (validators) => {
  return [...validators, validate];
};

module.exports = {
  validate,
  validateRequest
};



