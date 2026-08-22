@echo off
setlocal
title spicefe local server

set "PORT=%~1"
if not defined PORT set "PORT=45000"

set "SITE_ROOT=%~dp0."
if exist "%~dp0public\index.html" set "SITE_ROOT=%~dp0public"

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo Windows PowerShell 5.1 was not found.
  echo This helper requires a supported Windows 10 or Windows 11 installation.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Root "%SITE_ROOT%" -Port "%PORT%"

set "STATUS=%ERRORLEVEL%"
if not "%STATUS%"=="0" (
  echo.
  echo The spicefe server stopped with an error.
  pause
)
exit /b %STATUS%
