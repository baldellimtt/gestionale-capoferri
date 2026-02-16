const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const https = require('https');
const helmet = require('helmet');
require('dotenv').config();

// Valida variabili d'ambiente PRIMA di importare altri moduli
const envValidator = require('./utils/envValidator');
envValidator.validateServerConfig();

const DatabaseManager = require('./db/database');
const Logger = require('./utils/loggerWinston');
const BackupService = require('./services/backup');
const FattureInCloudSync = require('./services/fattureInCloudSync');
const authMiddleware = require('./utils/authMiddleware');
const ErrorHandler = require('./utils/errorHandler');
const rateLimiter = require('./utils/rateLimiter');
const createCsrfProtection = require('./utils/csrfProtection');
const createPrivacyRetention = require('./utils/privacyRetention');

// Usa variabili d'ambiente validate
const PORT = parseInt(process.env.PORT, 10);
const HOST = process.env.HOST || '127.0.0.1';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'gestionale.db');
const NODE_ENV = process.env.NODE_ENV || 'development';
const HTTP_ENABLED = (process.env.HTTP_ENABLED || (NODE_ENV === 'production' ? 'false' : 'true')).toLowerCase() === 'true';
const HTTPS_ENABLED = (process.env.HTTPS_ENABLED || (NODE_ENV === 'production' ? 'true' : 'false')).toLowerCase() === 'true';
const HTTPS_REDIRECT = (process.env.HTTPS_REDIRECT || (HTTPS_ENABLED ? 'true' : 'false')).toLowerCase() === 'true';
const FORCE_HTTPS = (process.env.FORCE_HTTPS || (NODE_ENV === 'production' ? 'true' : 'false')).toLowerCase() === 'true';
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '443', 10);
const HTTPS_KEY_PATH = process.env.HTTPS_KEY_PATH || '';
const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH || '';
const HTTPS_PFX_PATH = process.env.HTTPS_PFX_PATH || '';
const HTTPS_PFX_PASSPHRASE = process.env.HTTPS_PFX_PASSPHRASE || '';

// Inizializza database
const dbManager = new DatabaseManager(DB_PATH);
const db = dbManager.getDb();

// Inizializza Express
const app = express();
const csrfProtection = createCsrfProtection();

// Trust proxy (per IP reali dietro reverse proxy)
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy === 'true') {
  app.set('trust proxy', true);
} else if (trustProxy === 'false' || !trustProxy) {
  app.set('trust proxy', false);
} else {
  const trustProxyHops = parseInt(trustProxy, 10);
  if (!Number.isNaN(trustProxyHops)) {
    app.set('trust proxy', trustProxyHops);
  }
}

let httpsServerEnabled = false;
const trustProxyEnabled = !!app.get('trust proxy');

if (NODE_ENV === 'production' && FORCE_HTTPS && !HTTPS_ENABLED && !trustProxyEnabled) {
  throw new Error('Configurazione non sicura: in produzione con FORCE_HTTPS=true serve HTTPS_ENABLED=true o TRUST_PROXY abilitato');
}

// Security Headers (Helmet)
const hstsEnabled = (process.env.HSTS_ENABLED || 'true').toLowerCase() === 'true';
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
    },
  } : false, // Disabilita CSP in development per facilit?? sviluppo
  crossOriginEmbedderPolicy: false, // Necessario per alcuni browser
  hsts: hstsEnabled
}));

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    const corsOrigin = process.env.CORS_ORIGIN || '*';
    
    // In development o se CORS_ORIGIN ?? '*', permette tutte le origini
    if (NODE_ENV === 'development' || corsOrigin === '*' || !origin) {
      return callback(null, true);
    }
    
    // In production, usa CORS_ORIGIN configurato
    if (corsOrigin === origin || corsOrigin.split(',').includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: (process.env.CORS_ORIGIN || '*') !== '*' && NODE_ENV !== 'development',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Redirect HTTP -> HTTPS when HTTPS is available (avoid mixed content)
app.use((req, res, next) => {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (isSecure) {
    return next();
  }
  if (NODE_ENV === 'production' && FORCE_HTTPS && (!HTTPS_REDIRECT || !httpsServerEnabled)) {
    return res.status(426).json({ error: 'HTTPS obbligatorio' });
  }
  if (!HTTPS_REDIRECT || !httpsServerEnabled) {
    return next();
  }
  const host = req.headers.host || '';
  return res.redirect(301, `https://${host}${req.originalUrl}`);
});

// Body parsing
const uploadMaxSize = process.env.UPLOAD_MAX_SIZE_MB 
  ? `${process.env.UPLOAD_MAX_SIZE_MB}mb` 
  : '10mb';
app.use(express.json({ limit: uploadMaxSize }));
app.use(express.urlencoded({ extended: true, limit: uploadMaxSize }));
app.use('/api', csrfProtection.issueToken, csrfProtection.verifyRequest);

// Rate Limiting (applicato a tutte le route API, tranne auth)
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || (NODE_ENV === 'production' ? '100' : '1000'), 10);
const apiLimiter = rateLimiter.createLimiter({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  message: 'Troppe richieste, riprova pi? tardi'
});
const authRateLimitWindowMs = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '600000', 10);
const authRateLimitMax = parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || (NODE_ENV === 'production' ? '20' : '200'), 10);
const authLimiter = rateLimiter.createLimiter({
  windowMs: authRateLimitWindowMs,
  max: authRateLimitMax,
  message: 'Troppi tentativi di autenticazione, riprova piu tardi',
  skipSuccessfulRequests: true
});
app.use('/api', (req, res, next) => {
  if ((req.path || '').startsWith('/auth/')) {
    return next();
  }
  return apiLimiter(req, res, next);
});
app.use('/api/auth', (req, res, next) => {
  const path = req.path || '';
  const isSensitiveAuth = req.method === 'POST'
    && (path === '/login' || path === '/refresh' || path === '/accept-invite');
  if (!isSensitiveAuth) {
    return next();
  }
  return authLimiter(req, res, next);
});

// Static files
const fs = require('fs');
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

// Client static files (build) - per hosting locale senza Vite dev server
const serveStatic = (process.env.SERVE_STATIC || 'false').toLowerCase() === 'true';
const clientDist = process.env.CLIENT_DIST || path.join(__dirname, '..', 'gestionale-client', 'dist');
let resolvedClientDist = clientDist;
let serveStaticEnabled = false;
if (serveStatic) {
  resolvedClientDist = path.isAbsolute(clientDist)
    ? clientDist
    : path.join(__dirname, clientDist);
  const indexPath = path.join(resolvedClientDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    app.use(express.static(resolvedClientDist));
    serveStaticEnabled = true;
  } else {
    Logger.warn('Static client non trovato, serveStatic disabilitato', { indexPath });
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint per resettare rate limiter (solo in development)
if (NODE_ENV === 'development') {
  app.post('/api/admin/reset-rate-limit', (req, res) => {
    rateLimiter.reset();
    Logger.info('Rate limiter resettato manualmente');
    res.json({ success: true, message: 'Rate limiter resettato' });
  });
}

// Routes
app.use('/api/auth', require('./routes/auth')(db));
app.use('/api', authMiddleware(db));
app.use('/api/utenti', (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Permesso negato' });
  }
  return next();
}, require('./routes/utenti')(db));
app.use('/api/impostazioni', (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Permesso negato' });
  }
  return next();
}, require('./routes/impostazioni')(db));
app.use('/api/privacy', (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Permesso negato' });
  }
  return next();
}, require('./routes/privacy')(db, createPrivacyRetention(db)));
app.use('/api/clienti', require('./routes/clienti')(db));
app.use('/api/attivita', require('./routes/attivita')(db));
app.use('/api/commesse', require('./routes/commesse')(db));
app.use('/api/tracking', require('./routes/tracking')(db));
app.use('/api/note-spese', require('./routes/noteSpese')(db));
app.use('/api/kanban', require('./routes/kanban')(db));
app.use('/api/presence', require('./routes/presence')(db));
app.use('/api/fatturazione', (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Permesso negato' });
  }
  return next();
}, require('./routes/fatturazione')(db));

// SPA fallback (solo se serve static)
if (serveStaticEnabled) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    return res.sendFile(path.join(resolvedClientDist, 'index.html'));
  });
}

// Error handling middleware (usa ErrorHandler centralizzato)
app.use(ErrorHandler.handle);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint non trovato' });
});

// Inizializza backup automatico (se abilitato)
const backupEnabled = process.env.BACKUP_ENABLED !== 'false';
if (backupEnabled) {
  const backupService = new BackupService();
  const BACKUP_INTERVAL_HOURS = parseInt(process.env.BACKUP_INTERVAL_HOURS || '24', 10);
  const BACKUP_INTERVAL_MS = BACKUP_INTERVAL_HOURS * 60 * 60 * 1000;

  // Backup iniziale
  backupService.createBackup().catch(err => {
    Logger.error('Errore backup iniziale', err);
  });

  // Backup periodico
  setInterval(() => {
    backupService.createBackup().catch(err => {
      Logger.error('Errore backup periodico', err);
    });
  }, BACKUP_INTERVAL_MS);

  Logger.info(`Backup automatico configurato (ogni ${BACKUP_INTERVAL_HOURS} ore)`);
} else {
  Logger.info('Backup automatico disabilitato');
}

const privacyRetentionEnabled = (process.env.PRIVACY_RETENTION_ENABLED || 'true').toLowerCase() === 'true';
if (privacyRetentionEnabled) {
  const privacyRetention = createPrivacyRetention(db);
  const privacyRetentionIntervalHours = parseInt(process.env.PRIVACY_RETENTION_RUN_HOURS || '24', 10);
  const privacyRetentionIntervalMs = Math.max(1, privacyRetentionIntervalHours) * 60 * 60 * 1000;
  const privacyDays = parseInt(process.env.PRIVACY_REQUEST_RETENTION_DAYS || '730', 10);
  const securityDays = parseInt(process.env.SECURITY_EVENT_RETENTION_DAYS || '90', 10);

  const runPrivacyRetention = () => {
    try {
      const result = privacyRetention.run({ privacyDays, securityDays });
      Logger.info('Privacy retention eseguita', {
        privacyDays,
        securityDays,
        ...result
      });
    } catch (error) {
      Logger.error('Errore privacy retention', error);
    }
  };

  runPrivacyRetention();
  setInterval(runPrivacyRetention, privacyRetentionIntervalMs);
} else {
  Logger.info('Privacy retention disabilitata');
}

// Sync automatico anagrafica da Fatture in Cloud (se abilitato)
const fattureInCloudSync = new FattureInCloudSync(db);
fattureInCloudSync.start();

// Avvia server HTTP (opzionale)
if (HTTP_ENABLED) {
  http.createServer(app).listen(PORT, HOST, () => {
    Logger.info(`Server HTTP avviato su ${HOST}:${PORT}`);
    Logger.info(`Database: ${DB_PATH}`);
  });
} else {
  Logger.info('Server HTTP disabilitato da configurazione');
}

// Avvia server HTTPS (opzionale)
if (HTTPS_ENABLED) {
  let httpsOptions = null;
  if (HTTPS_PFX_PATH && fs.existsSync(HTTPS_PFX_PATH)) {
    httpsOptions = {
      pfx: fs.readFileSync(HTTPS_PFX_PATH),
      passphrase: HTTPS_PFX_PASSPHRASE || undefined
    };
  } else if (HTTPS_KEY_PATH && HTTPS_CERT_PATH && fs.existsSync(HTTPS_KEY_PATH) && fs.existsSync(HTTPS_CERT_PATH)) {
    httpsOptions = {
      key: fs.readFileSync(HTTPS_KEY_PATH),
      cert: fs.readFileSync(HTTPS_CERT_PATH)
    };
  }

  if (httpsOptions) {
    https.createServer(httpsOptions, app).listen(HTTPS_PORT, HOST, () => {
      httpsServerEnabled = true;
      Logger.info(`Server HTTPS avviato su ${HOST}:${HTTPS_PORT}`);
    });
  } else {
    Logger.warn('HTTPS abilitato ma certificato non trovato', {
      HTTPS_PFX_PATH,
      HTTPS_KEY_PATH,
      HTTPS_CERT_PATH
    });
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  Logger.info('Chiusura server...');
  dbManager.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  Logger.info('Chiusura server...');
  dbManager.close();
  process.exit(0);
});

module.exports = app;






