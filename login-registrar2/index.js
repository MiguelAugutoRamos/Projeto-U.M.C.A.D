require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const db = require('./db');

// Passport + Google
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// Iniciando Passport
app.use(passport.initialize());
app.use(passport.session());

// Estratégia Google
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.BASE_URL}/auth/google/callback`
}, (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;

  db.query('SELECT * FROM users WHERE email = ?', [email], (err, rows) => {
    if (err) return done(err);
    if (!rows.length) {
      db.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, 'GOOGLE_LOGIN'], (err2) => {
        if (err2) return done(err2);
        return done(null, { email });
      });
    } else {
      return done(null, { email });
    }
  });
}));

passport.serializeUser((user, done) => done(null, user.email));
passport.deserializeUser((email, done) => done(null, { email }));

// Rotas Google
app.get('/auth/google', passport.authenticate('google', { scope: ['email', 'profile'] }));
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    req.session.email = req.user.email;
    res.redirect('/notes.html');
  }
);

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Função código
function gerarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Nodemailer
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Middleware
function autenticar(req, res, next) {
  if (req.session.email) return next();
  res.status(401).send('⚠️ Não autorizado');
}

// Enviar código por e-mail
app.post('/enviar-codigo', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send('Informe um e-mail.');

  const codigo = gerarCodigo();
  req.session.codigoVerificacao = codigo;
  req.session.emailVerificando = email;

  const mail = {
    from: 'Verificação <no-reply@meusistema.com>',
    to: email,
    subject: 'Código de verificação',
    text: `Seu código de verificação é: ${codigo}`
  };

  transporter.sendMail(mail, err => {
    if (err) return res.status(500).send('Erro ao enviar e-mail.');
    res.send('📨 Código enviado para seu e-mail!');
  });
});

// Registro unificado
app.post('/registrar-unificado', async (req, res) => {
  const { email, codigo, password } = req.body;
  if (!email || !codigo || !password) return res.status(400).send('Preencha todos os campos.');

  if (codigo !== req.session.codigoVerificacao || email !== req.session.emailVerificando)
    return res.status(401).send('Código inválido ou expirado.');

  try {
    const hash = await bcrypt.hash(password, 10);
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, rows) => {
      if (err) return res.status(500).send('Erro no servidor');
      if (rows.length) return res.status(409).send('E-mail já cadastrado');

      db.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hash], err2 => {
        if (err2) return res.status(500).send('Erro ao cadastrar');
        res.send('✅ Conta criada com sucesso!');
      });
    });
  } catch {
    res.status(500).send('Erro interno ao registrar.');
  }
});

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, rows) => {
    if (err || !rows.length) return res.status(401).send('E-mail ou senha inválidos');
    const ok = await bcrypt.compare(password, rows[0].password);
    if (!ok) return res.status(401).send('Senha incorreta');

    req.session.email = email;
    res.send('✅ Login realizado com sucesso!');
  });
});

// Criar nota
app.post('/notes', autenticar, (req, res) => {
  const { content } = req.body;
  const email = req.session.email;
  db.query('INSERT INTO notes (user_email, content) VALUES (?, ?)', [email, content], err => {
    if (err) return res.status(500).send('Erro ao salvar nota');
    res.send('📝 Nota salva!');
  });
});

// Listar notas
app.get('/notes', autenticar, (req, res) => {
  const email = req.session.email;
  db.query('SELECT * FROM notes WHERE user_email = ?', [email], (err, rows) => {
    if (err) return res.status(500).send('Erro ao buscar notas');
    res.json(rows);
  });
});

// Rota fallback
app.use((req, res) => {
  res.status(404).send('❌ Página não encontrada.');
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Rodando em http://localhost:${PORT}`);
});

