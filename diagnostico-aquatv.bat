@echo off
setlocal
cd /d "%~dp0"

echo Diagnostico AquaTV
echo ==================
echo Pasta: %~dp0
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\diagnose-aquatv.ps1" -ProjectPath "%~dp0."

echo.
pause
