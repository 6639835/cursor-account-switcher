@echo off
REM Test runner script for Cursor Account Switcher (Windows)

echo Running Cursor Account Switcher Tests
echo ========================================

echo.
echo Running frontend tests...
call npm run test:frontend
if %errorlevel% neq 0 (
    echo Frontend tests failed
    exit /b %errorlevel%
)
echo Frontend tests passed

echo.
echo Running backend tests...
cd src-tauri
call cargo test
if %errorlevel% neq 0 (
    echo Backend tests failed
    cd ..
    exit /b %errorlevel%
)
cd ..
echo Backend tests passed

echo.
echo All tests passed!

