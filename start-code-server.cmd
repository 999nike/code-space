@echo off
wsl.exe -d Ubuntu -- bash -lc "nohup code-server --bind-addr 127.0.0.1:8080 >/tmp/code-space-code-server.log 2>&1 </dev/null &"
