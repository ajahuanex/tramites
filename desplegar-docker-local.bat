@echo off
title Despliegue Local Docker - DRTC Puno
echo =======================================================
echo   Despliegue Local con Docker - DRTC Puno
echo =======================================================

echo.
echo [1/2] Construyendo la aplicacion Angular localmente...
echo (Esto evita que Docker use demasiada memoria al compilar)
call npm run build
if %errorlevel% neq 0 (
    echo Error durante la construccion de Angular.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/2] Iniciando contenedores Docker...
docker-compose up -d --build

echo.
echo =======================================================
echo   Frontend: http://localhost:8087
echo   Pocketbase: http://localhost:8094/_/ (Admin)
echo =======================================================
echo.
echo Los contenedores estan corriendo en segundo plano.
echo Para ver los logs: docker-compose logs -f
echo Para detener: docker-compose down
echo.
pause
