@echo off
setlocal

:: CONFIGURAÇÕES
set USUARIO=root
set SCRIPT=sql\setup.sql

:: Solicita senha do MySQL
echo ===============================
echo === SETUP DO PROJETO INICIADO ===
echo ===============================
echo.
set /p SENHA=Digite sua senha do MySQL:

:: Etapa 1: Executa script SQL
echo.
echo 📦 Criando/verificando tabelas no banco...
mysql -u %USUARIO% -p%SENHA% < %SCRIPT%
IF %ERRORLEVEL% NEQ 0 (
    echo ❌ Erro ao executar o script SQL.
    pause
    exit /b
)

echo ✅ Tabelas criadas/verificadas com sucesso!

:: Etapa 2: Inicia servidor Node.js
echo.
echo ▶️ Iniciando servidor Node.js...
start "Servidor Node.js" cmd /k "node index.js"

:: Espera alguns segundos antes do próximo passo
timeout /t 3 > nul

:: Etapa 3: Inicia ngrok
echo ▶️ Iniciando ngrok...
start "Ngrok" cmd /k "ngrok http --url=sharply-open-polecat.ngrok-free.app 3000"

echo.
echo Tudo pronto! 🎉
pause
endlocal

