@echo off
title Despliegue Local DRTC Puno
echo =======================================================
echo   Despliegue Local - DRTC Puno (Angular + Pocketbase)
echo =======================================================

echo.
echo [1/3] Construyendo la aplicacion Angular (Produccion)...
call npm run build
if %errorlevel% neq 0 (
    echo Error durante la construccion de Angular.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Iniciando el backend (Pocketbase) en 2do plano...
:: Abre una nueva ventana para PocketBase
start "PocketBase" /D "%~dp0pocketbase" pocketbase.exe serve

echo.
echo [3/3] Iniciando el frontend (Angular SSR)...
echo =======================================================
echo   Angular estara disponible en http://localhost:4000
echo   Pocketbase esta disponible en http://localhost:8090
echo =======================================================
node dist/licencias-app/server/server.mjs
