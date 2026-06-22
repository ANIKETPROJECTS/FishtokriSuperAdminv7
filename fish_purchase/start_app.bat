@echo off
echo Starting Fish Purchase Application...
echo.

REM Get the directory where the batch file is located
cd /d "%~dp0"

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

REM Start Backend Server
echo Starting Backend Server on port 8010...
start "Fish Purchase Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --reload --port 8010"
timeout /t 3 /nobreak >nul

REM Start Frontend Server
echo Starting Frontend Server on port 5173...
start "Fish Purchase Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 5 /nobreak >nul

REM Open browser
echo Opening browser...
start http://localhost:5173

echo.
echo Both services are starting...
echo Backend: http://127.0.0.1:8010
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit this window (services will continue running)...
pause >nul

