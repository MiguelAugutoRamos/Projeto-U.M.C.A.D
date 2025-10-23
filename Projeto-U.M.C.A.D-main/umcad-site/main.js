// main.js
require('dotenv').config();

const express   = require('express');
const path      = require('path');
const http      = require('http');
const WebSocket = require('ws');
const session   = require('express-session');
const Database  = require('better-sqlite3');
const { OAuth2Client } = require('google-auth-library');
const nodemailer = require('nodemailer');
const ngrok = require('@ngrok/ngrok');

// 1) Express + HTTP + WebSocket
const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });
const PORT   = process.env.PORT || 3000;
const tempo   = 10;   // tempo padrão para ser registrado os dados (MINUTOS)

// 2) SQLite + criação de tabelas
const db = new Database(process.env.SQLITE_FILE || './data.db', { fileMustExist: false });
try {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_email TEXT NOT NULL,
      chave TEXT NOT NULL,
      valor TEXT NOT NULL,
      UNIQUE(usuario_email, chave)
    );

    CREATE TABLE IF NOT EXISTS leituras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      temp REAL,
      umidAr REAL,
      umidSolo REAL,
      gasInflamavel REAL,
      gasToxico REAL,
      estaChovendo INTEGER,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(user_email) REFERENCES users(email)
    );
  `;

  db.exec(sql);
  console.log('✅ Todas as tabelas foram criadas com sucesso');
} catch (err) {
  console.error('❌ Erro ao criar tabelas:', err.message);
}

// 3) Helpers de acesso ao banco
const dbRun = (sql, params = []) => db.prepare(sql).run(params);
const dbGet = (sql, params = []) => db.prepare(sql).get(params);
const dbAll = (sql, params = []) => db.prepare(sql).all(params);

// 4) Middleware de segurança: CSP + Permissions-Policy
function setSecurityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', [
    // 🔒 Origem padrão
    "default-src 'self';",

    // 🧠 Scripts inline + Google Identity
    "script-src 'self' 'unsafe-inline' 'unsafe-hashes' https://accounts.google.com https://apis.google.com https://*.gstatic.com;",

    // 🎨 Estilos e estilos inline
    "style-src-elem 'self' 'unsafe-inline' 'unsafe-hashes' https://accounts.google.com https://fonts.googleapis.com https://accounts.google.com/gsi/style;",

    // 💬 Imagens (inclusive de avatar do Google)
    "img-src 'self' data: https://*.googleusercontent.com https://*.gstatic.com;",

    // 🧩 Fontes da Google (ex: Roboto)
    "font-src 'self' https://fonts.gstatic.com;",

    // 📺 Frames e popups do Google
    "frame-src 'self' https://accounts.google.com https://accounts.google.com/gsi;",

    // 🌐 Conexões externas (ex: WebSocket ou login)
    "connect-src 'self' wss: https://accounts.google.com https://*.gstatic.com;",

    // 🧼 Bloqueios extras
    "object-src 'none';",
    "base-uri 'self';",
    "form-action 'self';"
  ].join(' '));

  res.setHeader('Permissions-Policy',
    'geolocation=(), camera=(), microphone=()'
  );

  next();
}

// 5) Middleware de autenticação
function autenticar(req, res, next) {
  if (req.session && typeof req.session.email === 'string') {
    return next();
  }

  // Se for rota API ou requisição AJAX, retorna JSON
  const isApi  = req.originalUrl.startsWith('/api/');
  const isAjax = req.xhr || req.get('Accept')?.includes('application/json');

  if (isApi || isAjax) {
    return res
      .status(401)
      .json({ status: 'erro', mensagem: '🔒 Acesso negado: usuário não autenticado.' });
  }

  // Em rotas normais: redireciona para a página inicial
  return res.redirect('/');
}

// 6) Aplica middlewares gerais
app.use(setSecurityHeaders);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'troque-essa-senha',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));
app.use(express.static(path.join(__dirname, 'public')));

// 7) Google OAuth2
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// 8) Monta o router (passando o middleware de autenticação e o transporter)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function obterDelay(email, dbGet) {
  // Exemplo de implementação: busca o valor "delay" na tabela config
  const row = dbGet(
    'SELECT valor FROM config WHERE usuario_email = ? AND chave = ?',
    [email, 'delay']
  );
  return row ? parseInt(row.valor, 10) : tempo*6e4; // DELAY // o "tempo*6e4" e a definição do delay padrão
}

const createRouter = require('./router');
const { router, sensorTokenHandler } = createRouter({
  dbRun,
  dbGet,
  dbAll,
  googleClient,
  autenticar,
  transporter,
  obterDelay: email => obterDelay(email, dbGet),
  clientesWS: {},
  ultimoRegistroPorEmail: {}
});

app.use('/', router);
app.post('/api/sensor/token', sensorTokenHandler);

// 9) WebSocket
wss.on('connection', ws => {
  if (typeof router.ws === 'function') {
    router.ws(ws);
  }
});

// 10) Sobe o servidor
server.listen(PORT, async () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  try {
    const tunnel = await ngrok.connect({
      authtoken: process.env.NGROK_AUTHTOKEN,
      addr: PORT,
      domain: process.env.BASE_URL?.replace(/^https?:\/\//, '')
    });

    console.log(`🌐 Ngrok online: ${tunnel.url()}`);
  } catch (err) {
    console.error('❌ Erro ao iniciar ngrok:', err.message);
  }
});

