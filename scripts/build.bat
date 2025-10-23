@echo off
REM Build script for Windows

echo Building Cursor Switcher for production...

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

REM Install dependencies
echo Installing dependencies...
call npm install

REM Build the application
echo Building application...
call npm run tauri build

echo Build complete!
echo Check src-tauri\target\release\bundle\ for the output
pause

