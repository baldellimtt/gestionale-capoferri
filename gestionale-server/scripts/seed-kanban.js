/**
 * Script per inserire dati di esempio nel Kanban
 * Esegui con: node scripts/seed-kanban.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'gestionale.db');
const db = new Database(DB_PATH);

console.log('🌱 Inserimento dati di esempio Kanban...\n');

try {
  // Verifica che esistano colonne
  const colonne = db.prepare('SELECT * FROM kanban_colonne ORDER BY ordine ASC').all();
  if (colonne.length === 0) {
    console.log('❌ Nessuna colonna trovata. Esegui prima le migrazioni.');
    process.exit(1);
  }

  // Verifica che esistano clienti
  const clienti = db.prepare('SELECT * FROM clienti LIMIT 5').all();
  if (clienti.length === 0) {
    console.log('⚠️  Nessun cliente trovato. Creando clienti di esempio...');
    const clientiEsempio = [
      { denominazione: 'Studio Architettura Rossi', partitaIva: '12345678901' },
      { denominazione: 'Edilizia Costruzioni SRL', partitaIva: '23456789012' },
      { denominazione: 'Progetti Ingegneria Spa', partitaIva: '34567890123' },
      { denominazione: 'Cantiere Nord Italia', partitaIva: '45678901234' },
      { denominazione: 'Urbanistica Moderna', partitaIva: '56789012345' }
    ];

    const insertCliente = db.prepare(`
      INSERT INTO clienti (denominazione, partita_iva, created_at, updated_at)
      VALUES (?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `);

    clientiEsempio.forEach(cliente => {
      insertCliente.run(cliente.denominazione, cliente.partitaIva);
    });
    console.log('✓ Clienti di esempio creati');
  }

  // Verifica che esistano commesse
  const commesse = db.prepare('SELECT * FROM commesse LIMIT 5').all();
  if (commesse.length === 0) {
    console.log('⚠️  Nessuna commessa trovata. Creando commesse di esempio...');
    const clienti = db.prepare('SELECT * FROM clienti LIMIT 5').all();
    
    const insertCommessa = db.prepare(`
      INSERT INTO commesse (
        titolo, cliente_id, cliente_nome, stato, stato_pagamenti,
        importo_totale, data_inizio, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `);

    const commesseEsempio = [
      { titolo: 'Progetto Residenziale Via Roma', cliente: clienti[0] },
      { titolo: 'Ristrutturazione Edificio Storico', cliente: clienti[1] },
      { titolo: 'Nuovo Complesso Commerciale', cliente: clienti[2] },
      { titolo: 'Piano Urbanistico Zona Nord', cliente: clienti[3] },
      { titolo: 'Ampliamento Scuola Elementare', cliente: clienti[4] }
    ];

    commesseEsempio.forEach(commessa => {
      insertCommessa.run(
        commessa.titolo,
        commessa.cliente.id,
        commessa.cliente.denominazione,
        'In corso',
        'Parziale',
        50000 + Math.random() * 200000,
        new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      );
    });
    console.log('✓ Commesse di esempio create');
  }

  // Verifica che esista almeno un utente
  const utenti = db.prepare('SELECT * FROM utenti LIMIT 1').get();
  if (!utenti) {
    console.log('❌ Nessun utente trovato. Crea prima un utente.');
    process.exit(1);
  }

  // Pulisci dati esistenti (opzionale - commenta se vuoi mantenere i dati)
  console.log('🧹 Pulizia dati Kanban esistenti...');
  db.prepare('DELETE FROM kanban_card_commenti').run();
  db.prepare('DELETE FROM kanban_scadenze').run();
  db.prepare('DELETE FROM kanban_notifiche').run();
  db.prepare('DELETE FROM kanban_card').run();
  console.log('✓ Dati esistenti rimossi');

  // Ottieni dati necessari
  const colonneData = db.prepare('SELECT * FROM kanban_colonne ORDER BY ordine ASC').all();
  const clientiData = db.prepare('SELECT * FROM clienti LIMIT 5').all();
  const commesseData = db.prepare('SELECT * FROM commesse LIMIT 5').all();
  const userId = utenti.id;

  // Prepara statement per inserimento card
  const insertCard = db.prepare(`
    INSERT INTO kanban_card (
      commessa_id, titolo, descrizione, colonna_id, priorita,
      cliente_id, cliente_nome, ordine, avanzamento,
      data_inizio, data_fine_prevista, budget, created_by,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `);

  // Prepara statement per inserimento scadenze
  const insertScadenza = db.prepare(`
    INSERT INTO kanban_scadenze (
      card_id, titolo, descrizione, data_scadenza, tipo, priorita,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `);

  // Prepara statement per inserimento commenti
  const insertCommento = db.prepare(`
    INSERT INTO kanban_card_commenti (
      card_id, user_id, commento, created_at, updated_at
    ) VALUES (?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `);

  // Dati di esempio per le card
  const cardEsempio = [
    {
      titolo: 'Analisi preliminare struttura',
      descrizione: 'Verifica della fattibilità strutturale del progetto residenziale. Analisi dei carichi e delle fondazioni.',
      colonna: colonneData.find(c => c.nome === 'Progettazione'),
      priorita: 'alta',
      cliente: clientiData[0],
      commessa: commesseData[0],
      ordine: 1,
      dataInizio: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dataFine: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
      titolo: 'Calcolo strutturale travi',
      descrizione: 'Dimensionamento delle travi principali secondo normativa vigente. Verifica delle sollecitazioni.',
      colonna: colonneData.find(c => c.nome === 'Calcolo Strutturale'),
      priorita: 'urgente',
      cliente: clientiData[0],
      commessa: commesseData[0],
      ordine: 1,
      dataInizio: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dataFine: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
      titolo: 'Elaborati grafici planimetrie',
      descrizione: 'Preparazione delle planimetrie per la presentazione al cliente. Include sezioni e prospetti.',
      colonna: colonneData.find(c => c.nome === 'Documentazione'),
      priorita: 'media',
      cliente: clientiData[1],
      commessa: commesseData[1],
      ordine: 1,
      dataInizio: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dataFine: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
      titolo: 'Pratica edilizia comune',
      descrizione: 'Preparazione documentazione per richiesta permesso di costruire. Coordinamento con tecnico comunale.',
      colonna: colonneData.find(c => c.nome === 'Pratiche'),
      priorita: 'alta',
      cliente: clientiData[2],
      commessa: commesseData[2],
      ordine: 1,
      dataInizio: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dataFine: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
      titolo: 'Revisione progetto esecutivo',
      descrizione: 'Controllo finale degli elaborati prima della presentazione. Verifica conformità normativa.',
      colonna: colonneData.find(c => c.nome === 'Approvazione'),
      priorita: 'bassa',
      cliente: clientiData[3],
      commessa: commesseData[3],
      ordine: 1,
      dataInizio: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dataFine: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
      titolo: 'Sopralluogo cantiere',
      descrizione: 'Verifica stato avanzamento lavori. Controllo qualità esecuzione e rispetto progetto.',
      colonna: colonneData.find(c => c.nome === 'Esecuzione'),
      priorita: 'media',
      cliente: clientiData[4],
      commessa: commesseData[4],
      ordine: 1,
      dataInizio: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dataFine: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
      titolo: 'Collaudo statico',
      descrizione: 'Verifica finale della struttura. Test di carico e controllo documentazione.',
      colonna: colonneData.find(c => c.nome === 'Collaudo'),
      priorita: 'urgente',
      cliente: clientiData[0],
      commessa: commesseData[0],
      ordine: 1,
      dataInizio: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dataFine: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
      titolo: 'Chiusura pratica',
      descrizione: 'Finalizzazione documentazione e archiviazione progetto. Consegna al cliente.',
      colonna: colonneData.find(c => c.nome === 'Chiusura'),
      priorita: 'bassa',
      cliente: clientiData[1],
      commessa: commesseData[1],
      ordine: 1,
      dataInizio: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dataFine: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    {
      titolo: 'Nuovo progetto da definire',
      descrizione: 'Progetto in fase iniziale. Da definire dettagli e tempistiche.',
      colonna: colonneData.find(c => c.nome === 'In Attesa'),
      priorita: 'bassa',
      cliente: clientiData[2],
      commessa: null,
      ordine: 1,
      dataInizio: null,
      dataFine: null
    },
    {
      titolo: 'Verifica impianti',
      descrizione: 'Controllo conformità impianti elettrici e idraulici. Coordinamento con installatori.',
      colonna: colonneData.find(c => c.nome === 'Esecuzione'),
      priorita: 'alta',
      cliente: clientiData[3],
      commessa: commesseData[3],
      ordine: 2,
      dataInizio: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dataFine: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  ];

  console.log('\n📝 Creazione card Kanban...');
  const cardIds = [];

  cardEsempio.forEach((card, index) => {
    if (!card.colonna) {
      console.log(`⚠️  Colonna non trovata per card: ${card.titolo}`);
      return;
    }

    const result = insertCard.run(
      card.commessa?.id || null,
      card.titolo,
      card.descrizione,
      card.colonna.id,
      card.priorita,
      card.cliente?.id || null,
      card.cliente?.denominazione || null,
      card.ordine,
      0,
      card.dataInizio,
      card.dataFine,
      0,
      userId
    );

    cardIds.push(result.lastInsertRowid);
    console.log(`  ✓ Card creata: "${card.titolo}" (ID: ${result.lastInsertRowid})`);
  });

  console.log(`\n✓ ${cardIds.length} card create`);

  // Crea scadenze di esempio
  console.log('\n⏰ Creazione scadenze...');
  const scadenzeEsempio = [
    {
      cardId: cardIds[0],
      titolo: 'Consegna analisi preliminare',
      descrizione: 'Scadenza per la consegna del documento di analisi preliminare al cliente',
      dataScadenza: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tipo: 'documento',
      priorita: 'alta'
    },
    {
      cardId: cardIds[1],
      titolo: 'Revisione calcoli strutturali',
      descrizione: 'Verifica e approvazione dei calcoli da parte del responsabile tecnico',
      dataScadenza: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tipo: 'documento',
      priorita: 'urgente'
    },
    {
      cardId: cardIds[2],
      titolo: 'Presentazione planimetrie',
      descrizione: 'Riunione con cliente per presentazione elaborati grafici',
      dataScadenza: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tipo: 'pratica',
      priorita: 'media'
    },
    {
      cardId: cardIds[3],
      titolo: 'Deposito pratica comune',
      descrizione: 'Consegna documentazione completa all\'ufficio tecnico comunale',
      dataScadenza: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tipo: 'pratica',
      priorita: 'alta'
    },
    {
      cardId: cardIds[6],
      titolo: 'Collaudo statico - SCADUTA',
      descrizione: 'Collaudo statico da completare urgentemente',
      dataScadenza: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tipo: 'cantiere',
      priorita: 'urgente'
    }
  ];

  scadenzeEsempio.forEach((scadenza) => {
    if (scadenza.cardId) {
      insertScadenza.run(
        scadenza.cardId,
        scadenza.titolo,
        scadenza.descrizione,
        scadenza.dataScadenza,
        scadenza.tipo,
        scadenza.priorita
      );
      console.log(`  ✓ Scadenza creata: "${scadenza.titolo}"`);
    }
  });

  console.log(`\n✓ ${scadenzeEsempio.length} scadenze create`);

  // Crea commenti di esempio
  console.log('\n💬 Creazione commenti...');
  const commentiEsempio = [
    {
      cardId: cardIds[0],
      commento: 'Analisi completata. Risultati positivi, struttura fattibile.'
    },
    {
      cardId: cardIds[0],
      commento: 'In attesa di feedback dal cliente per procedere.'
    },
    {
      cardId: cardIds[1],
      commento: 'Calcoli verificati. Tutto conforme alle normative.'
    },
    {
      cardId: cardIds[2],
      commento: 'Elaborati pronti per la revisione finale.'
    },
    {
      cardId: cardIds[3],
      commento: 'Documentazione completa. Pronta per il deposito.'
    }
  ];

  commentiEsempio.forEach((commento) => {
    if (commento.cardId) {
      insertCommento.run(commento.cardId, userId, commento.commento);
      console.log(`  ✓ Commento aggiunto`);
    }
  });

  console.log(`\n✓ ${commentiEsempio.length} commenti creati`);

  // Crea notifiche di esempio
  console.log('\n🔔 Creazione notifiche...');
  const insertNotifica = db.prepare(`
    INSERT INTO kanban_notifiche (
      user_id, tipo, titolo, messaggio, card_id, link, letto, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `);

  const notificheEsempio = [
    {
      tipo: 'card_creata',
      titolo: 'Nuova card creata',
      messaggio: `È stata creata una nuova card: "${cardEsempio[0].titolo}"`,
      cardId: cardIds[0]
    },
    {
      tipo: 'scadenza_prossima',
      titolo: 'Scadenza prossima',
      messaggio: `Scadenza imminente: "${scadenzeEsempio[0].titolo}"`,
      cardId: cardIds[0]
    },
    {
      tipo: 'scadenza_scaduta',
      titolo: 'Scadenza scaduta',
      messaggio: `ATTENZIONE: Scadenza scaduta: "${scadenzeEsempio[4].titolo}"`,
      cardId: cardIds[6]
    },
    {
      tipo: 'card_modificata',
      titolo: 'Card modificata',
      messaggio: `La card "${cardEsempio[1].titolo}" è stata aggiornata`,
      cardId: cardIds[1]
    }
  ];

  notificheEsempio.forEach((notifica) => {
    if (notifica.cardId) {
      insertNotifica.run(
        userId,
        notifica.tipo,
        notifica.titolo,
        notifica.messaggio,
        notifica.cardId,
        `/kanban?card=${notifica.cardId}`,
        0
      );
      console.log(`  ✓ Notifica creata: "${notifica.titolo}"`);
    }
  });

  console.log(`\n✓ ${notificheEsempio.length} notifiche create`);

  console.log('\n✅ Dati di esempio Kanban inseriti con successo!');
  console.log(`\n📊 Riepilogo:`);
  console.log(`   - Card create: ${cardIds.length}`);
  console.log(`   - Scadenze create: ${scadenzeEsempio.length}`);
  console.log(`   - Commenti creati: ${commentiEsempio.length}`);
  console.log(`   - Notifiche create: ${notificheEsempio.length}`);
  console.log('\n🎉 Puoi ora visualizzare i dati nel Kanban!');

} catch (error) {
  console.error('❌ Errore durante l\'inserimento dei dati:', error);
  process.exit(1);
} finally {
  db.close();
}

