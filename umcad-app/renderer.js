const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  console.log('✅ renderer.js carregado');

  const tokenInput   = document.getElementById('tokenInput');
  const emailPartial = document.getElementById('emailPartial');
  const botaoLeitura = document.getElementById('botaoLeitura');
  const btnHistorico = document.getElementById('botaoHistorico');
  const btnAoVivo    = document.getElementById('botaoAoVivo');
  const status       = document.getElementById('status');

  console.log('📦 Elementos DOM carregados:', {
    tokenInput, emailPartial, botaoLeitura, btnHistorico, btnAoVivo, status
  });

  // Atualiza texto do botão de leitura
  function atualizarBotaoLeitura(ativa) {
    const modo = ativa ? 'Parar' : 'Iniciar';
    botaoLeitura.textContent = ativa ? '🔴 Parar Leitura' : '▶️ Iniciar Leitura';
    console.log(`🔁 Botão atualizado para modo: ${modo}`);
  }

  // Inicialização
  async function init() {
    console.log('🚀 Iniciando função init()');

    const ativa = await ipcRenderer.invoke('verificar-leitura');
    console.log('🛰️ Leitura ativa?', ativa);
    atualizarBotaoLeitura(ativa);

    const token   = await ipcRenderer.invoke('get-token');
    tokenInput.value = token;
    console.log('🔐 Token carregado:', token);

    const partial = await ipcRenderer.invoke('get-email-partial');
    emailPartial.textContent = partial
      ? partial + '****@****'
      : 'offline – aguardando…';
    console.log('📧 Email parcial:', partial || 'offline');
  }
  init();

  // Exposição de funções para HTML
  window.salvarToken = () => {
    const token = tokenInput.value.trim();
    console.log('💾 salvarToken() chamado com:', token);

    if (!token) {
      status.textContent = '⚠️ Token vazio';
      status.style.color = 'orange';
      console.warn('⚠️ Token está vazio');
      return;
    }

    ipcRenderer.send('salvar-token', token);
    console.log('📨 Token enviado via IPC');

    ipcRenderer.once('token-salvo', async (_, salvo) => {
      console.log('✅ Token salvo confirmado:', salvo);
      status.textContent = '🔐 Token salvo';
      status.style.color = 'lightgreen';
      setTimeout(() => (status.textContent = ''), 3000);

      const partial = await ipcRenderer.invoke('get-email-partial');
      emailPartial.textContent = partial
        ? partial + '****@****'
        : 'offline – aguardando…';
      console.log('📧 Email atualizado após salvar token:', partial || 'offline');
    });
  };

  window.alternarLeitura = () => {
    const modoAtual = botaoLeitura.textContent.includes('Parar') ? 'Parar' : 'Iniciar';
    console.log(`🖱️ Botão "${modoAtual} Leitura" clicado`);
    botaoLeitura.disabled = true;
    ipcRenderer.send('alternar-leitura');
    console.log('📨 Enviado alternar-leitura via IPC');
  };

  window.abrirHistorico = () => {
    console.log('🕒 Botão "Abrir Histórico" clicado');
    ipcRenderer.send('abrir-historico');
  };

  window.abrirLive = () => {
    console.log('📡 Botão "Abrir Ao Vivo" clicado');
    ipcRenderer.send('abrir-live');
  };

  // Handlers de IPC
  ipcRenderer.on('email-atualizado', (_, partial) => {
    console.log('📩 email-atualizado recebido:', partial);
    emailPartial.textContent = partial + '****@****';
  });

  ipcRenderer.on('leitura-atualizada', async (_, msg) => {
    console.log('📩 leitura-atualizada recebido:', msg);
    botaoLeitura.disabled = false;

    status.textContent = msg;
    status.style.color = msg.includes('iniciada') ? 'lightgreen' : 'red';

    const ativa = await ipcRenderer.invoke('verificar-leitura');
    console.log('🔍 Após leitura-atualizada → leitura ativa?', ativa);
    atualizarBotaoLeitura(ativa);
  });

  ipcRenderer.on('token-atualizado', (_, novoToken) => {
    console.log('🛂 token-atualizado recebido:', novoToken);
    tokenInput.value = novoToken;
  });
});

