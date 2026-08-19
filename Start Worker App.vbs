Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "E:\WIZZ-Server\workspaces\code-space"

' Start code-server with the same WSL command that works manually, but hidden.
shell.Run "wsl.exe -d Ubuntu -- bash -lc " & Chr(34) & "exec code-server --bind-addr 0.0.0.0:8080" & Chr(34), 0, False
WScript.Sleep 2000

' Start the Worker App supervisor hidden as normal.
shell.Run "node worker-app-supervisor.js", 0, False
