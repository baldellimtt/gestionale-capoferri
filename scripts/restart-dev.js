/**
 * Script per riavviare l'applicazione
 * Chiude i processi esistenti e riavvia server e client
 */

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const isWindows = os.platform() === 'win32';

// Colori per output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString('it-IT');
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function killNodeProcesses() {
  return new Promise((resolve) => {
    log('Chiusura processi Node.js esistenti...', 'yellow');
    
    if (isWindows) {
      // Windows: usa taskkill
      const kill = spawn('taskkill', ['/F', '/IM', 'node.exe'], {
        stdio: 'ignore',
        shell: true
      });
      
      kill.on('close', (code) => {
        if (code === 0) {
          log('Processi Node.js chiusi con successo', 'green');
        } else {
          log('Nessun processo Node.js trovato o già chiuso', 'cyan');
        }
        setTimeout(resolve, 2000); // Attesa per liberare porte
      });
    } else {
      // Linux/Mac: usa pkill
      const kill = spawn('pkill', ['-f', 'node.*server.js|vite|node.*start-dev.js'], {
        stdio: 'ignore'
      });
      
      kill.on('close', (code) => {
        if (code === 0) {
          log('Processi Node.js chiusi con successo', 'green');
        } else {
          log('Nessun processo Node.js trovato o già chiuso', 'cyan');
        }
        setTimeout(resolve, 2000); // Attesa per liberare porte
      });
    }
  });
}

function startServer() {
  return new Promise((resolve) => {
    log('Avvio server...', 'yellow');
    
    const serverPath = path.join(__dirname, '..', 'gestionale-server');
    const server = spawn('npm', ['run', 'dev'], {
      cwd: serverPath,
      stdio: 'pipe',
      shell: isWindows
    });

    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server avviato') || output.includes('listening')) {
        log('Server avviato con successo', 'green');
      }
      process.stdout.write(`[SERVER] ${output}`);
    });

    server.stderr.on('data', (data) => {
      process.stderr.write(`[SERVER] ${data}`);
    });

    server.on('error', (error) => {
      log(`Errore avvio server: ${error.message}`, 'red');
    });

    // Attesa breve per assicurarsi che il server sia avviato
    setTimeout(() => {
      resolve(server);
    }, 3000);
  });
}

function startClient() {
  return new Promise((resolve) => {
    log('Avvio client...', 'yellow');
    
    const clientPath = path.join(__dirname, '..', 'gestionale-client');
    const client = spawn('npm', ['run', 'dev'], {
      cwd: clientPath,
      stdio: 'pipe',
      shell: isWindows
    });

    client.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Local:') || output.includes('ready')) {
        log('Client avviato con successo', 'green');
      }
      process.stdout.write(`[CLIENT] ${output}`);
    });

    client.stderr.on('data', (data) => {
      process.stderr.write(`[CLIENT] ${data}`);
    });

    client.on('error', (error) => {
      log(`Errore avvio client: ${error.message}`, 'red');
    });

    resolve(client);
  });
}

async function restart() {
  console.log('');
  log('========================================', 'bright');
  log('Riavvio Gestionale Capoferri', 'bright');
  log('========================================', 'bright');
  console.log('');

  // Chiudi processi esistenti
  await killNodeProcesses();

  console.log('');
  log('Attesa liberazione porte...', 'yellow');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('');

  // Avvia server e client
  const server = await startServer();
  const client = await startClient();

  console.log('');
  log('========================================', 'bright');
  log('Applicazione avviata!', 'green');
  log('========================================', 'bright');
  log('Server: http://localhost:3001', 'cyan');
  log('Client: http://localhost:5173', 'cyan');
  console.log('');
  log('Premi Ctrl+C per fermare l\'applicazione', 'yellow');
  console.log('');

  // Gestione chiusura graceful
  const shutdown = () => {
    log('Chiusura applicazione...', 'yellow');
    server.kill('SIGTERM');
    client.kill('SIGTERM');
    
    setTimeout(() => {
      log('Applicazione chiusa', 'green');
      process.exit(0);
    }, 2000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Avvia il riavvio
restart().catch((error) => {
  log(`Errore: ${error.message}`, 'red');
  process.exit(1);
});



