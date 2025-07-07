const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Caminho do projeto
const PROJECT_PATH = "C:/Users/Usuario/Desktop/projetoA";
app.use(express.static(path.join(PROJECT_PATH, "public")));

// Configuração da porta serial
const portaSerial = "COM3"; // Ajuste para sua porta correta
const serial = new SerialPort({
  path: portaSerial,
  baudRate: 115200
});

const parser = serial.pipe(new ReadlineParser({ delimiter: '\n' }));

// Exibir dados da porta serial no terminal
parser.on('data', (data) => {
  console.log("🔌 Dados recebidos da porta USB:", data);

  try {
    const partes = data.trim().split('|');
    if (partes[0] === "DADOS" && partes.length === 6) {
      const json = {
        temp: parseFloat(partes[1]) + " °C",
        umidAr: parseFloat(partes[2]) + " %",
        umidSolo: parseInt(partes[3]) + " %",
        gasInflamavel: parseInt(partes[4]) + " %",
        gasToxico: parseInt(partes[5]) + " %"
      };

      console.log('📦 Dados processados:', json);

      // Enviar dados para clientes WebSocket
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(json));
        }
      });
    }
  } catch (err) {
    console.error('⚠️ Erro ao processar dados:', err.message);
  }
});

// Iniciar servidor
server.listen(8080, () => {
  console.log('✅ Servidor rodando em http://localhost:8080');
  console.log('📡 Aguardando conexões WebSocket...');
});

// WebSocket - Conectar clientes
wss.on('connection', (ws) => {
  console.log('🌐 Cliente conectado ao WebSocket.');

  ws.on('message', (message) => {
    console.log(`📦 Dados recebidos do cliente: ${message}`);
  });

  ws.on('close', () => {
    console.log('🔴 Cliente desconectado.');
  });
});
