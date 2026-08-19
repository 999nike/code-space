Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "E:\WIZZ-Server\workspaces\code-space"
shell.Run "node worker-app-supervisor.js", 0, False
