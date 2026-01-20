# Quick Start - Ottimizzazioni Implementate

## 🚀 Installazione Dipendenze

```bash
cd gestionale-server
npm install
```

## ✅ Cosa è Stato Implementato

### Backend

1. **Validazione Input Completa**
   - express-validator per tutte le route
   - Validazione email, telefono, P.IVA, CF, CAP, date
   - Password policy (min 8 caratteri, maiuscole, numeri)

2. **JWT Support**
   - Access token e refresh token
   - Backward compatible con token custom esistente
   - Endpoint `/api/auth/refresh` per refresh token

3. **Security**
   - Helmet.js per security headers
   - CORS configurato
   - Rate limiting (100 req/15min API, 20 req/15min auth in dev)
   - File upload validation

4. **Logging Strutturato**
   - Winston logger
   - Log su file (logs/error.log, logs/combined.log)
   - Rotazione automatica

5. **Performance**
   - Paginazione supportata
   - Cache in-memory per dati statici
   - Query ottimizzate

### Frontend

**Da implementare:**
- Error Boundary React
- Retry logic
- Logger centralizzato
- Sostituire console.error

## ⚙️ Configurazione

Crea file `.env` in `gestionale-server/`:

```env
# JWT (genera secret sicuri)
JWT_SECRET=<genera-con-openssl-rand-hex-64>
JWT_REFRESH_SECRET=<genera-con-openssl-rand-hex-64>
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Password Policy
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true

# Logging
LOG_DIR=./logs
LOG_LEVEL=info

# Cache
CACHE_TTL=300000
CACHE_MAX_SIZE=1000
```

## 🔧 Modifiche Breaking Changes

**Nessuna!** Tutte le modifiche sono backward compatible.

### Login Response

Il login ora restituisce anche `refreshToken`:
```json
{
  "token": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "customToken": "token-custom-per-compatibilita",
  "expiresAt": "...",
  "user": {...}
}
```

Il client può continuare a usare `token` come prima, oppure usare JWT.

## 📝 Note

- Rate limiter: se bloccato, riavvia server o chiama `POST /api/admin/reset-rate-limit` (solo dev)
- Password: nuove password devono rispettare policy (min 8 caratteri, maiuscole, numeri)
- Logs: creati automaticamente in `gestionale-server/logs/`

## 🐛 Troubleshooting

### Non riesco a loggarmi
1. Verifica rate limiting (riavvia server)
2. Controlla logs in `logs/error.log`
3. Verifica password policy se creando nuovo utente

### Errori validazione
- Controlla formato dati (email, telefono, P.IVA, etc.)
- Verifica campi obbligatori

### Logs non funzionano
- Verifica permessi directory `logs/`
- Controlla `LOG_DIR` in `.env`



