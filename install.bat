@echo off
echo ================================
echo   QC Track - Instalacion
echo ================================
echo.
echo Instalando dependencias del backend...
cd backend
npm install
if errorlevel 1 (
    echo ERROR instalando backend
    pause
    exit /b 1
)

echo.
echo Instalando dependencias del frontend...
cd ..\frontend
npm install
if errorlevel 1 (
    echo ERROR instalando frontend
    pause
    exit /b 1
)

echo.
echo ================================
echo  Instalacion completa!
echo  Ejecuta start.bat para iniciar
echo ================================
pause
