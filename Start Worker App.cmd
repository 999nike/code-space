@echo off
setlocal
cd /d E:\WIZZ-Server\workspaces\code-space
start "Worker App" /min cmd /c "node worker-app-supervisor.js %*"
exit /b 0
