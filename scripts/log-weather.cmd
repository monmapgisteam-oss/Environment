@echo off
rem ---------------------------------------------------------------------------
rem  Weather observation archiver -- runs INSIDE the local network.
rem
rem  NOTE: comments here are ASCII only. cmd.exe parses batch files in the
rem  OEM code page, so Cyrillic text breaks into stray commands. The full
rem  Mongolian explanation lives in scripts/log-weather.mjs and CLAUDE.md.
rem
rem  Why not GitHub Actions: the ArcGIS Enterprise host
rem  (environment.ub.gov.mn) is not reachable from the public internet --
rem  GitHub runners time out on port 443 (UND_ERR_CONNECT_TIMEOUT).
rem  The weather API itself is reachable; only ArcGIS is blocked.
rem
rem  Setup:
rem    1. Copy scripts\weather-secrets.example.cmd to
rem       scripts\weather-secrets.cmd and fill in the values.
rem       That file is gitignored.
rem    2. Task Scheduler -> Create Task
rem       Triggers: Daily, repeat every 1 hour, indefinitely
rem       Actions:  Start a program -> full path to this .cmd
rem       Start in: the repository root
rem ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0.."

if not exist "scripts\weather-secrets.cmd" (
  echo [log-weather] scripts\weather-secrets.cmd not found.
  echo [log-weather] Copy weather-secrets.example.cmd and fill it in.
  exit /b 1
)
call "scripts\weather-secrets.cmd"

rem Trust the server's self-signed certificate WITHOUT disabling
rem verification -- only this one certificate is trusted.
set "NODE_EXTRA_CA_CERTS=%CD%\scripts\environment-ub-gov-mn.pem"

rem Task Scheduler hides console output, so keep a log file.
if not exist "logs" mkdir "logs"
echo [%DATE% %TIME%] >> "logs\weather-archive.log"
node "scripts\log-weather.mjs" >> "logs\weather-archive.log" 2>&1
set CODE=%ERRORLEVEL%
echo [%DATE% %TIME%] exit=%CODE% >> "logs\weather-archive.log"
exit /b %CODE%
