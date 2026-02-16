# Procedura DSAR (Diritti Interessati)

Versione: 1.0
Ultimo aggiornamento: [YYYY-MM-DD]

## SLA operativo

- Presa in carico: entro 5 giorni lavorativi
- Risposta completa: entro 30 giorni (estendibile nei casi previsti)

## Flusso operativo

1. Ricezione richiesta su canale privacy ufficiale
2. Verifica identita richiedente
3. Registrazione richiesta nel registro DSAR interno
4. Esecuzione export/rettifica/anonimizzazione secondo caso
5. Chiusura con evidenza delle attivita svolte

## API DSAR disponibili (solo admin)

- `GET /api/privacy/requests`: elenco richieste
- `POST /api/privacy/requests`: apertura richiesta
- `PUT /api/privacy/requests/:id`: aggiornamento stato richiesta
- `GET /api/privacy/export/cliente/:id`: export dati cliente
- `GET /api/privacy/export/utente/:id`: export dati utente
- `POST /api/privacy/anonymize/cliente/:id`: anonimizzazione cliente
- `POST /api/privacy/anonymize/utente/:id`: anonimizzazione utente

## Note operative

- Tutte le operazioni devono essere autorizzate da admin.
- Le anonimizzazioni sono irreversibili dal punto di vista funzionale.
- Conservare evidenza della richiesta e della risposta.
