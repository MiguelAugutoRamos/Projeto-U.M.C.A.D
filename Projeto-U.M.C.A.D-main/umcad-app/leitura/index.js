const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());



//
// ⚙️ Configurações iniciais
//
let currentToken = '';
let configurado  = false;
let server  = null;
let simLoop = null;
const DEBUG     = true;
const EMULAR    = false;
const PORT      = parseInt(process.env.PORT,   10) || 8096;
const NGROK_URL = process.env.NGROK_URL         || '';
const BAUDRate  = 115200;


//
// 📌 Log de inicialização
//
console.log('🔌 index.js iniciado');



//
// 🛡️ Captura exceções não tratadas
//
process.on('uncaughtException', err => {
  console.error('🔥 Erro não capturado em index.js:', err);
  shutdown(1);
});



//
// 🚦 Sinais de encerramento
//
process.once('SIGTERM', () => shutdown(0));
process.once('SIGINT',  () => shutdown(0));



//
// 📴 Função de encerramento limpo
//
function shutdown(code = 0) {
  if (DEBUG) console.log('📴 Encerrando index.js...');
  if (simLoop) clearInterval(simLoop);
  if (server) {
    server.close(() => process.exit(code));
  } else {
    process.exit(code);
  }
}



//
// 🛠️ Rota de verificação do serviço
//
app.get('/verificar', (req, res) => {
  res.json({
    status: 'OK',
    modo: EMULAR ? 'Simulação' : 'Arduino',
    tokenAtual: currentToken || '(vazio)'
  });
});



//
// 📨 Recebe configurações do processo pai (main.js)
//
process.on('message', msg => {
  if (msg.type === 'token') {
    currentToken = msg.token;
    if (DEBUG) console.log('🔑 Token recebido:', currentToken);
  }

  if (!configurado) {
    configurado = true;
    server = app.listen(PORT, () => {
      if (DEBUG) console.log(`🖥️ Servidor ativo em http://localhost:${PORT}/verificar`);
    });
    if (EMULAR) iniciarSimulacao();
    else         iniciarArduino();
  }
});



//
// 📡 Envia leitura para NGROK e para o main.js via stdout
//
function enviar(leitura) {
  if (!currentToken) {
    if (DEBUG) console.warn('⚠️ Token não definido. Ignorando envio.');
    return;
  }

  const payload = { token: currentToken, ...leitura };

  // Envia para a API externa
  fetch(`${NGROK_URL}/api/sensor/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(err => {
    if (DEBUG) console.error('❌ Falha ao enviar dados:', err.message);
  });

  if (DEBUG) console.log('📡 Leitura enviada ao servidor:', payload);

  // Entrega a leitura ao main.js
  console.log(JSON.stringify(leitura));
}



//
// 🧪 Função de simulação de leituras
//
function iniciarSimulacao() {
  if (simLoop) return;
  if (DEBUG) console.log('🧪 Iniciando simulação de dados');
  simLoop = setInterval(() => {
    const leitura = {
      temp:           `${Math.floor(Math.random() * 30 + 10)}`,
      umidAr:         `${Math.floor(Math.random() * 100)}`,
      umidSolo:       `${Math.floor(Math.random() * 100)}`,
      gasInflamavel:  `${Math.floor(Math.random() * 20)}`,
      gasToxico:      `${Math.floor(Math.random() * 10)}`,
      estaChovendo:    Math.random() > 0.5
    };
    enviar(leitura);
  }, 5000);
}



//
// 🔌 Função de leitura via Arduino
//
async function iniciarArduino() {
  if (DEBUG) console.log('🔌 Iniciando leitura via Arduino');
  try {
    const portas = await SerialPort.list();
    const portaArduino = portas.find(p =>
      p.manufacturer?.toLowerCase().includes('arduino')
    );

    if (!portaArduino) {
      if (DEBUG) console.warn('⚠️ Arduino não encontrado. Retentando em 5s...');
      return setTimeout(iniciarArduino, 5000);
    }

    if (DEBUG) console.log(`⚡ Conectado ao Arduino em ${portaArduino.path}`);
    const sp = new SerialPort({ path: portaArduino.path, baudRate: BAUDRate });
    const parser = sp.pipe(new ReadlineParser({ delimiter: '\n' }));

    parser.on('data', linha => {
      if (!linha.startsWith('DADOS|')) return;
      const [_, t, ua, us, gi, gt, ch] = linha.trim().split('|');
      const leitura = {
        temp:           `${t}`,
        umidAr:         `${ua}`,
        umidSolo:       `${us}`,
        gasInflamavel:  `${gi}`,
        gasToxico:      `${gt}`,
        estaChovendo:    ch === '1' ? 1 : 0 //true ou false
      };
      enviar(leitura);
    });

    sp.on('error', e => console.error('❌ Erro na porta serial:', e.message));
  } catch (err) {
    console.error('❌ Falha ao iniciar Arduino:', err);
    setTimeout(iniciarArduino, 5000);
  }
}

