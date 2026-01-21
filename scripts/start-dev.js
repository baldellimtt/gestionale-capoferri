const { spawn } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
const serverPath = path.join(__dirname, '..', 'gestionale-server');
const clientPath = path.join(__dirname, '..', 'gestionale-client');

console.log('🚀 Avvio Gestionale Studio Capoferri...\n');

// Colori per output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  server: '\x1b[36m', // Cyan
  client: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
  success: '\x1b[32m' // Green
};

// Funzione per log formattato
function log(prefix, color, message) {
  const timestamp = new Date().toLocaleTimeString('it-IT');
  console.log(`${color}[${timestamp}] ${prefix}${colors.reset} ${message}`);
}

// Avvia server
const server = spawn(isWindows ? 'npm.cmd' : 'npm', ['run', 'dev'], {
  cwd: serverPath,
  stdio: 'pipe',
  shell: true
});

server.stdout.on('data', (data) => {
  const output = data.toString().trim();
  if (output) {
    log('SERVER', colors.server, output);
  }
});

server.stderr.on('data', (data) => {
  const output = data.toString().trim();
  if (output && !output.includes('DeprecationWarning')) {
    log('SERVER', colors.error, output);
  }
});

server.on('error', (error) => {
  log('SERVER', colors.error, `Errore: ${error.message}`);
});

server.on('close', (code) => {
  if (code !== 0) {
    log('SERVER', colors.error, `Processo terminato con codice ${code}`);
  }
});

// Avvia client (con piccolo delay per dare tempo al server)
setTimeout(() => {
  const client = spawn(isWindows ? 'npm.cmd' : 'npm', ['run', 'dev'], {
    cwd: clientPath,
    stdio: 'pipe',
    shell: true
  });

  client.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      log('CLIENT', colors.client, output);
    }
  });

  client.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output && !output.includes('DeprecationWarning')) {
      log('CLIENT', colors.error, output);
    }
  });

  client.on('error', (error) => {
    log('CLIENT', colors.error, `Errore: ${error.message}`);
  });

  client.on('close', (code) => {
    if (code !== 0) {
      log('CLIENT', colors.error, `Processo terminato con codice ${code}`);
    }
  });

  // Salva riferimento per cleanup
  process.clientProcess = client;
}, 2000);

// Salva riferimento per cleanup
process.serverProcess = server;

// Gestione chiusura graceful
process.on('SIGINT', () => {
  console.log('\n\n🛑 Arresto server e client...\n');
  
  if (process.serverProcess) {
    process.serverProcess.kill('SIGINT');
  }
  
  if (process.clientProcess) {
    process.clientProcess.kill('SIGINT');
  }
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Arresto server e client...\n');
  
  if (process.serverProcess) {
    process.serverProcess.kill('SIGTERM');
  }
  
  if (process.clientProcess) {
    process.clientProcess.kill('SIGTERM');
  }
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

console.log(`${colors.success}✓${colors.reset} Server in avvio su http://localhost:3001`);
console.log(`${colors.success}✓${colors.reset} Client in avvio su http://localhost:5173\n`);
console.log(`${colors.bright}Premi Ctrl+C per fermare entrambi i processi${colors.reset}\n`);





