@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-gpt-sovits-voice-pack.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed. See the message above.
  pause
  exit /b 1
)
echo.
echo Voice pack installation completed.
pause
