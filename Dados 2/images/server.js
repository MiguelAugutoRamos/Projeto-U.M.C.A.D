const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PROJECT_PATH = "C:/Users/Usuario/Desktop/projetoA";

app.use(express.static(path.join(PROJECT_PATH, "public")));

server.listen(8080, () => {
  console.log('✅ Servidor rodando em http://localhost:8080');
  console.log('📡 Aguardando conexões WebSocket...');
});

wss.on('connection', (ws) => {
  console.log('🌐 Cliente conectado ao WebSocket.');

  ws.on('message', (message) => {
    console.log(`📦 Dados recebidos: ${message}`);
    const dados = JSON.parse(message);

    ws.send(JSON.stringify({
      temp: `${dados.temp} °C`,
      umidAr: `${dados.umidAr} %`,
      umidSolo: `${dados.umidSolo} %`,
      gasInflamavel: `${dados.gasInflamavel} ppm`,
      gasToxico: `${dados.gasToxico} ppm`
    }));
  });

  ws.on('close', () => {
    console.log('🔴 Cliente desconectado.');
  });
});
