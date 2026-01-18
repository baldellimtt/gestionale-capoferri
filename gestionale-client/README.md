# Gestionale Studio Capoferri

Gestionale per la gestione di attività e anagrafica clienti.

## Tecnologie

- React 19
- Vite
- Bootstrap 5
- jsPDF (per export PDF)

## Installazione

```bash
cd gestionale-client
npm install
```

## Avvio

```bash
npm run dev
```

L'applicazione sarà disponibile su `http://localhost:5173`

## Funzionalità

### Anagrafica Clienti
- Aggiungi, modifica ed elimina clienti
- Campi disponibili:
  - Denominazione
  - Paese
  - Codice destinatario SDI
  - Indirizzo
  - Comune
  - CAP
  - Provincia
  - Partita IVA
  - Codice Fiscale

### Tabella Attività
- Visualizza le ultime 3 date (oggi, ieri, l'altro ieri)
- Espandi per vedere tutte le date
- Aggiungi nuove righe
- Modifica righe esistenti
- Filtri:
  - Mese corrente
  - Trimestre corrente
  - Periodo personalizzato
- Export PDF con filtri applicati
- Totali:
  - Totale KM
  - Numero indennità
  - Conteggio attività per tipo

## Stile

Lo stile utilizza i colori e font di Studio Capoferri:
- Colori primari: #2a3f54, #3d5a7a
- Font: Bebas Neue (headings), Inter (body)




