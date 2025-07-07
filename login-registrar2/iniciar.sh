#!/bin/bash

# === CONFIGURAÇÕES ===
USUARIO="root"
SENHA=""
SCRIPT="sql/setup.sql"
BANCO="meuprojeto"

echo "============================"
echo "   INICIANDO CONFIGURAÇÃO"
echo "============================"
read -sp "Digite sua senha do MySQL: " SENHA
echo ""

# Executa script que cria banco + tabelas
echo "🔧 Criando banco e tabelas se necessário..."
mysql -u "$USUARIO" -p"$SENHA" < "$SCRIPT"
if [ $? -ne 0 ]; then
  echo "❌ Erro ao executar o script SQL."
  exit 1
fi
echo "✅ Banco e tabelas prontos."

# Inicia servidor Node.js
echo "🚀 Iniciando servidor Node.js..."
x-terminal-emulator -e "bash -c 'node index.js; exec bash'"

# Espera alguns segundos
sleep 3

# Inicia ngrok (lembrando: --url não existe, precisa ser --domain)
echo "🌐 Iniciando ngrok..."
x-terminal-emulator -e "bash -c 'ngrok http 3000 --domain=sharply-open-polecat.ngrok-free.app; exec bash'"

