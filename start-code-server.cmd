@echo off
wsl.exe -d Ubuntu -- bash -lc "exec code-server --bind-addr 0.0.0.0:8080"
