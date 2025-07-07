@echo off
echo Iniciando servidor e ngrok...

:: Definir caminho do projeto
SET "PROJECT_PATH=C:\Users\Usuario\Desktop\projetoA"

:: Navegar para a pasta do projeto
cd /d "%PROJECT_PATH%"

:: Iniciar o servidor primeiro
start "" cmd /c "node server.js COM3"

:: Esperar alguns segundos para garantir que o servidor iniciou
timeout /t 5 /nobreak

:: Iniciar o ngrok dentro do projeto
start "" cmd /c "%PROJECT_PATH%\ngrok.exe http 8080 --domain=legal-ladybug-hideously.ngrok-free.app"

echo Servidor e ngrok iniciados com sucesso!
exit
