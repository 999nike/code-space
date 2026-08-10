# Code Space

Code Space is a local-first coding workspace shell built around **code-server**.

The app owns the project dashboard, workspace creation/clone/open flow and full-screen launch experience. `code-server` remains the actual coding engine for editor, terminal, extensions and project filesystem access.

## Current build

- Code Space dashboard / wrapper UI
- loopback-only local Node runtime on `127.0.0.1`
- real **New Project** folder creation
- real **Clone Repository** using local Git
- real **Open Existing** folder verification
- recent workspace list stored locally in the browser
- Git branch / clean-state inspection
- safe automatic `git pull --ff-only` only when the working tree is clean
- auto-pull skipped when local changes are present
- configurable local `code-server` address
- full-screen **Code Mode** takeover using code-server
- project folder passed to code-server using its `?folder=` launch parameter
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

The runtime defaults to:

```text
Code Space UI/runtime: http://127.0.0.1:8090
code-server:           http://127.0.0.1:8080
workspace root:        E:\WIZZ-Server\workspaces
```

No `npm install` is required. The runtime uses Node built-ins only.

## Optional runtime configuration

You can override the defaults before starting the runtime:

```powershell
$env:CODE_SPACE_PORT="8090"
$env:CODE_SPACE_WORKSPACES="E:\WIZZ-Server\workspaces"
$env:CODE_SERVER_URL="http://127.0.0.1:8080"
node server.js
```

For safety the runtime binds to `127.0.0.1` only. New and cloned projects are restricted to the configured workspace root. Opening an existing project can point at another local folder because that action is explicitly initiated by the local user.

## Project opening behaviour

When a saved project is opened:

```text
verify real folder
    -> inspect Git
    -> local changes?
         yes -> skip pull
         no  -> git pull --ff-only
    -> launch project in full-screen code-server
```

Code Space never auto-resets, auto-stashes or overwrites local changes.

## Direction

```text
Code Space
    |
    +-- project dashboard
    +-- local workspace runtime
    +-- code-server full-screen Code Mode
    +-- real local project folders
    +-- terminal
    +-- Git
    +-- AI CLI workers      <- next major layer
```
