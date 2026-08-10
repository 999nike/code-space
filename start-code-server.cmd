@echo off
wsl.exe -d Ubuntu -- bash -lc "exec code-server --bind-addr 127.0.0.1:8080"
