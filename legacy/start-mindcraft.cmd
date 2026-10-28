@echo off
setlocal
chcp 65001 >nul
set "MINDCRAFT_NODE="
for /d %%D in ("%~dp0..\runtime\node-v22.*-win-x64") do set "MINDCRAFT_NODE=%%~fD\node.exe"
if not defined MINDCRAFT_NODE (
  echo Project Node 22 runtime is missing.
  pause
  exit /b 1
)
cd /d "%~dp0..\mindcraft"
"%MINDCRAFT_NODE%" local\launch.mjs %*
set "MINDCRAFT_EXIT=%ERRORLEVEL%"
if not "%MINDCRAFT_EXIT%"=="0" pause
exit /b %MINDCRAFT_EXIT%
