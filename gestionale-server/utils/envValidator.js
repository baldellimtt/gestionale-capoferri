/**
 * Environment validator
 * Validates required and recommended runtime variables.
 */

class EnvValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  validate(key, options = {}) {
    const {
      required = false,
      default: defaultValue = null,
      validator = null,
      description = ''
    } = options;

    const value = process.env[key];

    if (!value && !required) {
      if (defaultValue !== null) {
        process.env[key] = defaultValue;
      }
      return defaultValue;
    }

    if (required && !value) {
      this.errors.push(`Missing required env var: ${key}${description ? ` (${description})` : ''}`);
      return null;
    }

    if (validator && typeof validator === 'function') {
      try {
        const isValid = validator(value);
        if (!isValid) {
          this.errors.push(`Invalid value for ${key}: ${value}${description ? ` (${description})` : ''}`);
          return null;
        }
      } catch (error) {
        this.errors.push(`Validation error for ${key}: ${error.message}`);
        return null;
      }
    }

    return value;
  }

  warn(message) {
    this.warnings.push(message);
  }

  validateAll() {
    if (this.errors.length > 0) {
      console.error('\nENV validation failed:\n');
      this.errors.forEach((error) => console.error(`  - ${error}`));
      console.error('\nCreate a .env file from .env.example and retry.\n');
      process.exit(1);
    }

    if (this.warnings.length > 0) {
      console.warn('\nENV warnings:\n');
      this.warnings.forEach((warning) => console.warn(`  - ${warning}`));
      console.warn('');
    }
  }

  validateServerConfig() {
    const NODE_ENV = this.validate('NODE_ENV', {
      required: false,
      default: 'development',
      validator: (val) => ['development', 'production', 'test'].includes(val),
      description: 'Runtime environment (development|production|test)'
    });
    const isProduction = NODE_ENV === 'production';

    this.validate('PORT', {
      required: false,
      default: '3001',
      validator: (val) => {
        const port = parseInt(val, 10);
        return !Number.isNaN(port) && port > 0 && port < 65536;
      },
      description: 'Server port'
    });

    this.validate('DB_PATH', {
      required: false,
      default: null,
      description: 'SQLite database path'
    });

    this.validate('JWT_SECRET', {
      required: isProduction,
      default: isProduction ? null : 'dev-secret-change-in-production',
      validator: (val) => val && val.length >= 32,
      description: 'JWT access secret (min 32 chars)'
    });

    this.validate('JWT_REFRESH_SECRET', {
      required: isProduction,
      default: isProduction ? null : 'dev-refresh-secret-change-in-production',
      validator: (val) => val && val.length >= 32,
      description: 'JWT refresh secret (min 32 chars)'
    });

    this.validate('JWT_EXPIRATION', {
      required: false,
      default: '15m',
      description: 'JWT access expiration'
    });

    this.validate('JWT_REFRESH_EXPIRATION', {
      required: false,
      default: '7d',
      description: 'JWT refresh expiration'
    });

    if (isProduction) {
      this.validate('CORS_ORIGIN', {
        required: true,
        validator: (val) => !!val && val !== '*',
        description: 'Allowed CORS origin (must not be *)'
      });
    } else {
      this.validate('CORS_ORIGIN', {
        required: false,
        default: '*',
        description: 'Allowed CORS origin'
      });
    }

    this.validate('TRUST_PROXY', {
      required: false,
      default: 'false',
      validator: (val) => {
        if (val === 'true' || val === 'false') return true;
        const asInt = parseInt(val, 10);
        return !Number.isNaN(asInt) && asInt >= 0;
      },
      description: 'Express trust proxy'
    });

    this.validate('RATE_LIMIT_WINDOW_MS', {
      required: false,
      default: '900000',
      validator: (val) => !Number.isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Rate limit window in ms'
    });

    this.validate('RATE_LIMIT_MAX_REQUESTS', {
      required: false,
      default: isProduction ? '100' : '1000',
      validator: (val) => !Number.isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Max requests per window'
    });
    this.validate('AUTH_RATE_LIMIT_WINDOW_MS', {
      required: false,
      default: '600000',
      validator: (val) => !Number.isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Auth rate limit window in ms'
    });
    this.validate('AUTH_RATE_LIMIT_MAX_REQUESTS', {
      required: false,
      default: isProduction ? '20' : '200',
      validator: (val) => !Number.isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Auth max failed requests per window'
    });

    this.validate('LOG_LEVEL', {
      required: false,
      default: isProduction ? 'info' : 'debug',
      validator: (val) => ['error', 'warn', 'info', 'debug'].includes(val),
      description: 'Log level'
    });

    this.validate('LOG_DIR', { required: false, default: './logs', description: 'Log directory' });
    this.validate('LOG_RETENTION_DAYS', {
      required: false,
      default: '30',
      validator: (val) => !Number.isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Log retention days'
    });
    this.validate('LOG_RETENTION_CHECK_HOURS', {
      required: false,
      default: '24',
      validator: (val) => !Number.isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Log cleanup interval hours'
    });

    this.validate('BACKUP_ENABLED', {
      required: false,
      default: 'true',
      validator: (val) => ['true', 'false'].includes(String(val).toLowerCase()),
      description: 'Enable backup'
    });
    this.validate('BACKUP_INTERVAL_HOURS', {
      required: false,
      default: '24',
      validator: (val) => !Number.isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Backup interval hours'
    });
    this.validate('BACKUP_DIR', { required: false, default: './backups', description: 'Backup directory' });

    this.validate('UPLOAD_MAX_SIZE_MB', {
      required: false,
      default: '10',
      validator: (val) => !Number.isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Upload max size MB'
    });
    this.validate('UPLOAD_DIR', { required: false, default: './uploads', description: 'Upload directory' });

    this.validate('APP_BASE_URL', {
      required: false,
      default: '',
      validator: (val) => {
        if (val == null || val === '') return true;
        try {
          // eslint-disable-next-line no-new
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      description: 'Public app base URL for invite links'
    });
    this.validate('INVITE_EXPIRATION_HOURS', {
      required: false,
      default: '48',
      validator: (val) => {
        const hours = parseInt(val, 10);
        return !Number.isNaN(hours) && hours > 0 && hours <= 336;
      },
      description: 'Invite expiration in hours (1-336)'
    });
    this.validate('REFRESH_COOKIE_NAME', {
      required: false,
      default: 'gestionale_refresh_token',
      description: 'Refresh token cookie name'
    });
    this.validate('REFRESH_COOKIE_PATH', {
      required: false,
      default: '/api/auth',
      description: 'Refresh token cookie path'
    });
    this.validate('REFRESH_COOKIE_DOMAIN', {
      required: false,
      default: '',
      description: 'Refresh token cookie domain'
    });
    this.validate('REFRESH_COOKIE_SECURE', {
      required: false,
      default: isProduction ? 'true' : 'false',
      validator: (val) => ['true', 'false'].includes(String(val).toLowerCase()),
      description: 'Refresh token cookie secure flag'
    });
    this.validate('REFRESH_COOKIE_SAMESITE', {
      required: false,
      default: 'lax',
      validator: (val) => ['lax', 'strict', 'none'].includes(String(val).toLowerCase()),
      description: 'Refresh token cookie SameSite'
    });
    this.validate('REFRESH_COOKIE_MAX_AGE_MS', {
      required: false,
      default: String(7 * 24 * 60 * 60 * 1000),
      validator: (val) => !Number.isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Refresh token cookie max age'
    });
    this.validate('CSRF_COOKIE_NAME', {
      required: false,
      default: 'gestionale_csrf_token',
      description: 'CSRF cookie name'
    });
    this.validate('CSRF_COOKIE_PATH', {
      required: false,
      default: '/api',
      description: 'CSRF cookie path'
    });
    this.validate('CSRF_COOKIE_DOMAIN', {
      required: false,
      default: '',
      description: 'CSRF cookie domain'
    });
    this.validate('CSRF_COOKIE_SECURE', {
      required: false,
      default: isProduction ? 'true' : 'false',
      validator: (val) => ['true', 'false'].includes(String(val).toLowerCase()),
      description: 'CSRF cookie secure flag'
    });
    this.validate('CSRF_COOKIE_SAMESITE', {
      required: false,
      default: 'lax',
      validator: (val) => ['lax', 'strict', 'none'].includes(String(val).toLowerCase()),
      description: 'CSRF cookie SameSite'
    });
    this.validate('CSRF_ENFORCE_ORIGIN', {
      required: false,
      default: 'true',
      validator: (val) => ['true', 'false'].includes(String(val).toLowerCase()),
      description: 'Enable Origin/Referer CSRF validation'
    });
    this.validate('PRIVACY_RETENTION_ENABLED', {
      required: false,
      default: 'true',
      validator: (val) => ['true', 'false'].includes(String(val).toLowerCase()),
      description: 'Enable privacy/security retention cleanup'
    });
    this.validate('PRIVACY_RETENTION_RUN_HOURS', {
      required: false,
      default: '24',
      validator: (val) => !Number.isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Retention cleanup interval hours'
    });
    this.validate('PRIVACY_REQUEST_RETENTION_DAYS', {
      required: false,
      default: '730',
      validator: (val) => !Number.isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Retention days for closed privacy requests'
    });
    this.validate('SECURITY_EVENT_RETENTION_DAYS', {
      required: false,
      default: '90',
      validator: (val) => !Number.isNaN(parseInt(val, 10)) && parseInt(val, 10) > 0,
      description: 'Retention days for auth/security events'
    });

    this.validate('HTTP_ENABLED', {
      required: false,
      default: isProduction ? 'false' : 'true',
      validator: (val) => ['true', 'false'].includes(String(val).toLowerCase()),
      description: 'Enable HTTP listener'
    });
    this.validate('HTTPS_ENABLED', {
      required: false,
      default: isProduction ? 'true' : 'false',
      validator: (val) => ['true', 'false'].includes(String(val).toLowerCase()),
      description: 'Enable HTTPS listener'
    });
    this.validate('FORCE_HTTPS', {
      required: false,
      default: isProduction ? 'true' : 'false',
      validator: (val) => ['true', 'false'].includes(String(val).toLowerCase()),
      description: 'Force HTTPS in production'
    });
    this.validate('SEED_DEFAULT_ADMIN', {
      required: false,
      default: isProduction ? 'false' : 'true',
      validator: (val) => ['true', 'false'].includes(String(val).toLowerCase()),
      description: 'Seed default admin on startup'
    });

    if (isProduction) {
      if ((process.env.HTTP_ENABLED || 'false').toLowerCase() === 'true') {
        this.warn('HTTP_ENABLED=true in production; prefer HTTPS only.');
      }
      if ((process.env.SEED_DEFAULT_ADMIN || 'false').toLowerCase() === 'true') {
        this.warn('SEED_DEFAULT_ADMIN=true in production; disable after bootstrap.');
      }
    }

    this.validateAll();
  }
}

module.exports = new EnvValidator();
