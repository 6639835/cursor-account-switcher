@echo off
REM Development script for Windows

echo Starting Cursor Switcher in development mode...

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install Node.js first.
    exit /b 1
)

REM Check if Rust is installed
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo Rust is not installed. Please install Rust first.
    exit /b 1
)

REM Install dependencies if needed
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
)

REM Run Tauri dev
echo Starting development server...
call npm run tauri dev

