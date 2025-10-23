const { app, BrowserWindow, ipcMain, Tray, Menu, clipboard, nativeImage } = require('electron');
const path     = require('path');
const fs       = require('fs');
const { fork }  = require('child_process');
const fetch    = require('node-fetch');
const Database = require('better-sqlite3');



//
// ⚙️ Configurações fixas
//
const dbPath  = path.join(app.getPath('userData'), 'umcad.db');
const db      = new Database(dbPath);
let janela, bandeja, processoLeitura = null, leituraAtiva = false;
let recordInterval = 10, lastRecordTime = 0;
let inicializandoLeitura = false;
const DEBUG         = true; // ← define DEBUG
const EMULAR        = false; // ← define EMULAR
const PORT          = 8096; // ← define PORT
const NGROK_URL     = 'https://iguana-capital-jawfish.ngrok-free.app'; // ← URL de entrada



//
// 🏗️ ─── bloco modular: atualizarMenuTray ───
//
let atualizarMenuTray = () => {
  // só roda se já tiver criado a bandeja
  if (!bandeja) {
    if (DEBUG) console.warn('⚠️ Bandeja ainda não criada. Ignorando atualização.');
    return;
  }

  const leituraItem = leituraAtiva
    ? {
        label: '❌ Encerrar Leitura',
        click: () => {
          stopLeitura({ reply: () => {} });
          atualizarMenuTray();
          console.log('atualizado');
        }
      }
    : {
        label: '▶️ Iniciar Leitura',
        click: () => {
          startLeitura({ reply: () => {} });
          atualizarMenuTray();
          console.log('atualizado');
        }
      };

  const menu = Menu.buildFromTemplate([
    { label: '🧭 Mostrar aplicativo', click: () => janela.show() },
    leituraItem,
    { label: '📡 Ver ao Vivo', click: () => { janela.loadFile('live.html'); janela.show(); } },
    { label: '🕒 Ver Histórico', click: () => { janela.loadFile('historico.html'); janela.show(); } },
    {
      label: '📋 Colar token',
      click: () => {
        const novoToken = clipboard.readText().trim();
        if (novoToken) {
          db.prepare('UPDATE config SET token = ?').run(novoToken);
          fetchEmailPartial();
          janela.webContents.send('token-atualizado', novoToken);
          if (leituraAtiva) {
            stopLeitura({ reply: () => {} });
            setTimeout(() => startLeitura({ reply: () => {} }), 500);
          }
          atualizarMenuTray();
        }
      }
    },
    {
  label: '🚪 Encerrar',
  click: () => {
    if (processoLeitura) {
      stopLeitura({ reply: () => {} });

      // aguarda o encerramento do filho antes de fechar o app
      const interval = setInterval(() => {
        if (!processoLeitura) {
          clearInterval(interval);
          app.exit(0);
        }
      }, 100); // checa a cada 100ms
    } else {
      app.exit(0);
    }
  }
}
  ]);

  bandeja.setContextMenu(menu);
  bandeja.setToolTip('UMCAD rodando em segundo plano');
};



//
// 🧱 Criação das tabelas
//
db.exec(`
  CREATE TABLE IF NOT EXISTS leituras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    temp TEXT,
    umidAr TEXT,
    umidSolo TEXT,
    gasInflamavel TEXT,
    gasToxico TEXT,
    estaChovendo TEXT,
    timestamp TEXT,
    token TEXT
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    token TEXT,
    delay INTEGER,
    email TEXT,
    recordInterval INTEGER,
    filterToken TEXT
  );
`);
const existeConfig = db.prepare('SELECT COUNT(*) AS total FROM config').get();
if (existeConfig.total === 0) {
  db.prepare('INSERT INTO config (token, delay, email, recordInterval, filterToken) VALUES (?, ?, ?, ?, ?)').run(
    '', 10, '', 10, '');
}



//
// 🔧 Carregando configurações
//
const config       = db.prepare('SELECT * FROM config LIMIT 1').get();
const EMAIL_PARTIAL= config.email || 'E-MAIL';
recordInterval     = config.recordInterval || config.delay || 10;
const env = Object.assign({}, process.env, {
  DEBUG:   DEBUG.toString(),
  EMULAR:  EMULAR.toString(),
  PORT:    PORT.toString(),
  NGROK_URL
});
let filterToken  = config.filterToken || '';



//
// 💾 Preparador de inserção de leitura
//
const insert = db.prepare(`
  INSERT INTO leituras
    (temp, umidAr, umidSolo, gasInflamavel, gasToxico, estaChovendo, timestamp, token)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);



//
// 🪟 Criar janela principal
//
function criarJanela() {
  if (janela) {
    console.warn('⛔ Janela já existe, ignorando criação duplicada');
    return;
  }

  janela = new BrowserWindow({
    width: 480, height: 500, resizable: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'renderer.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  janela.setMenuBarVisibility(false);
  janela.loadFile('index.html');
  janela.on('close', e => {
    e.preventDefault();
    janela.hide();
  });
  console.log('🪟 Janela principal criada:', janela?.id);
}



//
// 📋 Criar pequeno icone de 2° plano do sistema
//
function criarTray() {
  const trayIcon = nativeImage.createFromPath(getIconPath());
  bandeja = new Tray(trayIcon);
  if (DEBUG) console.log('✅ Bandeja criada');
  atualizarMenuTray(); // ✅ Agora funciona porque bandeja foi criada
}



//
// 📬 Buscar email parcial
//
async function fetchEmailPartial() {
  const token = db.prepare('SELECT token FROM config LIMIT 1').get()?.token;
  if (!token || !NGROK_URL) return;
  try {
    const res = await fetch(`${NGROK_URL}/api/user/email?token=${token}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { partial } = await res.json();
    if (partial && partial !== EMAIL_PARTIAL) {
      db.prepare('UPDATE config SET email = ?').run(partial);
      janela?.webContents.send('email-atualizado', partial);
    }
  } catch (err) {
    if (DEBUG) console.warn('❌ fetchEmailPartial falhou:', err.message);
  }
}



//
// 🛣 Caminho para os arquivos
//
function getIndexPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'leitura', 'index.js')
    : path.join(__dirname, 'leitura', 'index.js');
}

function getIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.png')
    : path.join(__dirname, 'assets', 'icon.png');
}



//
// 🎚️ Início da leitura
//
async function startLeitura(event) {
  if (processoLeitura || inicializandoLeitura) return;
  inicializandoLeitura = true;

  const tokenAtual = db.prepare('SELECT token FROM config LIMIT 1').get()?.token || '';
  const indexPath  = getIndexPath();

  console.log('🎯 startLeitura → indexPath:', indexPath);
  console.log('📁 process.resourcesPath:', process.resourcesPath);

  // aguarda arquivo estar acessível (evita falhas em AppImage temporário)
  const existe = await new Promise(resolve => {
    const inicio = Date.now();
    const timeoutMs = 5000;
    const checar = () => {
      if (fs.existsSync(indexPath)) return resolve(true);
      if (Date.now() - inicio > timeoutMs) return resolve(false);
      setTimeout(checar, 150);
    };
    checar();
  });

  if (!existe) {
    console.error(`❌ index.js não encontrado mesmo após espera: ${indexPath}`);
    inicializandoLeitura = false;
    return;
  }

  processoLeitura = fork(indexPath, [], {
    cwd: path.dirname(indexPath),
    env,
    silent: true,
  });

  processoLeitura.on('error', err => {
    console.error('🔥 Falha ao iniciar processo filho:', err);
  });

  processoLeitura.stdout.on('data', data => {
    data.toString().split('\n').forEach(line => {
      if (!line.startsWith('{')) return;
      try {
        const l = JSON.parse(line);

        // envia leitura ao vivo para UI
        janela.webContents.send('leitura-live', l);

        // grava no banco respeitando intervalo
        const agora = Date.now();
        if (agora - lastRecordTime >= recordInterval * 60 * 1000) {
          insert.run(
            l.temp + ' °C', l.umidAr + ' %', l.umidSolo + ' %',
            l.gasInflamavel + ' %', l.gasToxico + ' %',
            l.estaChovendo.toString(),
            new Date().toISOString(),
            tokenAtual
          );
          lastRecordTime = agora;
          console.log('✅ Leitura registrada no histórico');
          janela.webContents.send('historico-atualizar');
        } else {
          console.log('⏱️ Ignorado registro — dentro do intervalo definido');
        }
      } catch (e) {
        console.warn('⚠️ JSON inválido do filho:', line);
      }
    });
  });

  processoLeitura.stderr.on('data', err => {
    console.error('[ERRO index.js]:', err.toString());
  });

  processoLeitura.on('exit', code => {
    console.warn(`⚠️ Processo de leitura finalizou com código ${code}`);
    leituraAtiva        = false;
    processoLeitura     = null;
    inicializandoLeitura= false;
    atualizarMenuTray();
    janela.webContents.send('leitura-atualizada', '❌ Leitura encerrada');
  });

  processoLeitura.send({ type: 'token', token: tokenAtual });
  processoLeitura.send({ type: 'debug', debug: DEBUG });
  processoLeitura.send({ type: 'emular', emular: EMULAR });
  processoLeitura.send({ type: 'port', port: PORT || 8096 });
  processoLeitura.send({ type: 'ngrokUrl', ngrokUrl: NGROK_URL });

  leituraAtiva = true;
  atualizarMenuTray();

  try { event?.reply?.('leitura-atualizada', '📡 Leitura iniciada'); } catch {}
  janela.webContents.send('leitura-atualizada', '📡 Leitura iniciada');
}



//
// 🛑 Parar leitura
//
function stopLeitura(event) {
  console.log('🔴 stopLeitura() chamado — leituraAtiva antes:', leituraAtiva);
  if (!processoLeitura) return;
  processoLeitura.kill('SIGTERM');
  processoLeitura = null;
  leituraAtiva = false;
  atualizarMenuTray?.();
  try { event.reply?.('leitura-atualizada', '❌ Leitura encerrada'); } catch {}
  janela?.webContents.send('leitura-atualizada', '❌ Leitura encerrada');
}



//
// ⚡ Eventos principais do Electron
//
app.whenReady().then(() => {
  criarJanela();
  criarTray();
  fetchEmailPartial();
  setInterval(fetchEmailPartial, 10 * 60 * 1000); // a cada 10min
  app.setLoginItemSettings({ openAtLogin: true });
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) criarJanela();
});

app.on('window-all-closed', () => {
  // Mantém o app rodando em segundo plano
});



//
// 🛰️ IPC handlers (comunicação com o frontend)
//
ipcMain.handle('get-email-partial', () => {
  return db.prepare('SELECT email FROM config LIMIT 1').get()?.email || '';
});

ipcMain.handle('get-token', () => {
  return db.prepare('SELECT token FROM config LIMIT 1').get()?.token || '';
});

ipcMain.handle('verificar-leitura', () => leituraAtiva);

ipcMain.handle('get-interval', () => recordInterval);

ipcMain.on('set-interval', (event, mins) => {
  recordInterval = Math.max(1, parseInt(mins, 10));
  db.prepare('UPDATE config SET delay = ?, recordInterval = ?').run(recordInterval, recordInterval);
});

ipcMain.on('salvar-token', (event, token) => {
  if (typeof token !== 'string' || !token.trim()) return;

  const tokenLimpo = token.trim();
  db.prepare('UPDATE config SET token = ?').run(tokenLimpo);

  event.reply('token-salvo', tokenLimpo);
  janela?.webContents.send('token-salvo', tokenLimpo);
  janela?.webContents.send('token-atualizado', tokenLimpo);

  fetchEmailPartial();

  if (leituraAtiva) {
    stopLeitura(event);
    setTimeout(() => startLeitura(event), 500);
  }
});

let aguardandoStart = false;
let aguardandoLeitura = false;

ipcMain.on('alternar-leitura', event => {
  if (aguardandoLeitura) return;

  if (!leituraAtiva) {
    aguardandoLeitura = true;
    startLeitura(event);
    setTimeout(() => (aguardandoLeitura = false), 2000); // bloqueio temporário
  } else {
    stopLeitura(event);
  }
});

ipcMain.handle('get-historico', () => {
  if (filterToken && filterToken.trim()) {
    return db
      .prepare('SELECT * FROM leituras WHERE token = ? ORDER BY timestamp DESC')
      .all(filterToken);
  } else {
    return db
      .prepare('SELECT * FROM leituras ORDER BY timestamp DESC')
      .all();
  }
});

ipcMain.on('clear-historico', event => {
  db.prepare('DELETE FROM leituras').run();
  lastRecordTime = 0;
  event.reply('historico-limpo');
  janela?.webContents.send('historico-atualizar');
});

// retorna o filtro atual
ipcMain.handle('get-filter-token', () => filterToken);

// atualiza o filtro no banco e na variável
ipcMain.on('set-filter-token', (event, novoFiltro) => {
  filterToken = novoFiltro;
  db.prepare('UPDATE config SET filterToken = ?').run(filterToken);
  event.reply('filter-token-saved', filterToken);
});

ipcMain.on('abrir-historico', () => janela.loadFile('historico.html'));
ipcMain.on('abrir-live',      () => janela.loadFile('live.html'));
ipcMain.on('abrir-index',     () => janela.loadFile('index.html'));

