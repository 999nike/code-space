# Code Space

Code Space is a local-first coding workspace shell built around **code-server**.

The app owns the project dashboard, workspace creation/clone/open flow and full-screen launch experience. `code-server` remains the actual coding engine for editor, terminal, extensions and project filesystem access.

## Current architecture

On the HP, Code Space is split deliberately:

```text
Windows
  Code Space Node runtime :8090
  project folders / Git
        |
        v
Ubuntu WSL2
  code-server :8080
  VS Code web editor / terminal / extensions
```

The user sees this as one Code Space application. The wrapper starts the WSL code-server engine when needed and then hands the screen to Code Mode.

## Current build

- Code Space dashboard / wrapper UI
- loopback-only local Node runtime on `127.0.0.1:8090`
- Ubuntu WSL2 code-server engine on `127.0.0.1:8080`
- one-click **Start Coding** launch through WSL
- real **New Project** folder creation
- real **Clone Repository** using Windows Git
- real **Open Existing** folder verification
- recent workspace list stored locally in the browser
- Git branch / clean-state inspection
- safe automatic `git pull --ff-only` only when the working tree is clean
- auto-pull skipped when local changes are present
- full-screen **Code Mode** takeover using code-server
- Windows project paths automatically translated for WSL (`E:\\...` -> `/mnt/e/...`)
- return from Code Mode to the Code Space dashboard

Memory Space is not part of the first Code Space build. Cross-app connection can be added later through the minimal Connector contract.

## Start Code Space on the HP

From PowerShell:

```powershell
cd E:\WIZZ-Server\workspaces\code-space
git pull
node server.js
```

Then open:

```text
http://127.0.0.1:8090
```

Press **Start Coding**. The runtime will use `start-code-server.cmd` to launch the installed Ubuntu WSL code-server when it is not already running.

Defaults:

```text
Code Space UI/runtime: http://127.0.0.1:8090
code-server:           http://127.0.0.1:8080
workspace root:        E:\WIZZ-Server\workspaces
WSL distribution:      Ubuntu
```

The Code Space Node runtime itself requires no npm install; it uses Node built-ins only. code-server is installed separately inside Ubuntu WSL.

## Project opening behaviour

When a saved project is opened:

```text
verify real Windows folder
    -> inspect Git
    -> local changes?
         yes -> skip pull
         no  -> git pull --ff-only
    -> ensure WSL code-server is running
    -> translate Windows folder path to /mnt/<drive>/...
    -> launch project in full-screen Code Mode
```

Code Space never auto-resets, auto-stashes or overwrites local changes.

## Direction

```text
Code Space
    |
    +-- project dashboard
    +-- local workspace runtime
    +-- WSL code-server full-screen Code Mode
    +-- real local project folders
    +-- terminal
    +-- Git
    +-- AI CLI workers      <- next major layer
```
