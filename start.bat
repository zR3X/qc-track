@echo off
echo ================================
echo   QC Track - Control de Calidad
echo ================================
echo.
echo Iniciando Backend (puerto 3100)...
start "QC Backend" cmd /k "cd backend && node server.js"

echo Esperando backend...
timeout /t 2 /nobreak > nul

echo Iniciando Frontend (puerto 5173)...
start "QC Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ================================
echo  Abriendo navegador...
echo ================================
timeout /t 3 /nobreak > nul
start http://localhost:5173

echo.
echo App iniciada!
echo  Consulta publica:  http://localhost:5173
echo  Panel analistas:   http://localhost:5173/login
echo.
echo Credenciales de acceso:
echo  Admin:    admin / admin123
echo  Analista: analyst1 / analyst123
echo.
pause
