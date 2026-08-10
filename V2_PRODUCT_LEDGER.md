# Code Space V2 Product Ledger

**Updated:** 10 Aug 2026 — embedded Code Space editor proven

This is the active build / handoff ledger for:

```text
999nike/code-space
```

Keep this file short, factual and current. Update it after meaningful tested milestones.

---

## AUTHORITATIVE PRODUCT SPLIT

```text
Memory Space
999nike/memory-app
= trusted memory app
= FROZEN
= existing bridges stay there
= do not rebuild, move or refactor its working systems

Code Space
999nike/code-space
= separate local coding workspace
= browser/app wrapper around code-server
= active development repo

Memory Graph
999nike/memory-graph
= future visual memory/project graph

Memory Connector
999nike/memory-connector
= future minimal app-to-app / connection status layer
= does not replace or move the existing Memory App bridge
```

### Current override

Earlier V2 planning said there would be no separate Code Space app and referred to `wizz-workspace` as the next repo. That direction has now changed explicitly.

**The current active coding product is `999nike/code-space`.**

Do not resurrect the old `no Code Space` rule in future development chats.

---

# CODE SPACE PURPOSE

Code Space is primarily for the owner's own coding workflow. It is not being designed first as a polished commercial IDE product.

The goal is to combine proven programs into one app-like local coding environment instead of rebuilding an IDE from scratch.

Core model:

```text
CODE SPACE
browser/app shell
      |
      +-- Home / projects
      +-- New Project
      +-- Open Existing
      +-- Clone Repository
      +-- recent workspaces
      |
      v
EMBEDDED CODE MODE
      |
      v
code-server
      |
      +-- real local project folder
      +-- VS Code browser editor
      +-- terminal
      +-- extensions
      +-- Git
      +-- AI CLI workers
```

**code-server is the coding engine. Code Space is the wrapper / orchestrator / skin around it.**

Do not waste time recreating code-server features that already work.

---

# UX RULE

The Code Space home/wrapper should use the same general visual family as Memory Space: dark app shell, rounded panels, purple/blue glow accents and clear app-like navigation.

The wrapper remains visible while coding. When actual coding starts, **code-server loads inside the lower Code Space workspace panel**. The dashboard, sidebar and status rail remain available around it.

```text
Code Space Home
     |
     | Start Coding / Open project
     v
Code Space starts local code-server if needed
     |
     v
Embedded code-server panel
     |
     | Exit Code Mode / close panel
     v
Code Space Home
```

Target user experience: Code Space should be a one-click starter. The user should not need to manually start a terminal and code-server for normal use once the runtime path is complete.

---

# CURRENT IMPLEMENTED STATE

Implemented on 10 Aug 2026:

- responsive Code Space wrapper/dashboard
- Quick Start cards
- New Project flow
- Clone Repository flow
- Open Existing flow
- recent workspace list
- recent activity list
- local Code Space Node runtime on `http://127.0.0.1:8090`
- approved workspace root `E:\WIZZ-Server\workspaces`
- real local project listing/runtime operations started
- New Project, Open Existing and Clone Repository forms accept the appropriate path inputs
- successful project actions now continue into the selected embedded workspace
- configurable code-server URL
- code-server target `http://127.0.0.1:8080`
- code-server reachability check
- embedded Code Mode workspace panel below the dashboard
- Open Separately fallback
- Exit Code Mode hides the embedded editor and returns to the dashboard view
- Git/runtime status support
- one-click Start Coding route launches or reuses code-server automatically

### Embedded editor milestone — VERIFIED

The intended visual result is now working on the HP:

- Code Space dashboard remains visible.
- Sidebar and system-status rail remain visible.
- The real code-server editor loads in the lower embedded workspace panel.
- The editor is not forced into a full-screen takeover.
- Open Separately remains available as a fallback.
- The code-server editor, terminal, extensions and project filesystem remain provided by code-server.

This is the current Code Space baseline. Do not restore the earlier full-screen design unless the owner explicitly changes the product direction.

### Known-good fallback checkpoint

Before the next project-workflow patch, preserve this tested state:

```text
HP-tested GitHub baseline: 201fa1d
Local source checkpoint:    a622a9e
```

`201fa1d` is the last embedded-editor version confirmed working on the HP. If the next patch causes trouble, return to that published baseline before investigating further. Do not force-push or delete the checkpoint.

### Local coding engine established

The HP Windows machine now has:

```text
Windows 11
  |
  +-- WSL2
       |
       +-- Ubuntu 26.04 LTS
            user: wizz
            |
            +-- code-server 4.132.0
```

Verified manually from Windows PowerShell:

```text
wsl -d Ubuntu -- bash -lc "command -v code-server; code-server --version"
/usr/bin/code-server
4.132.0
```

Verified manual launch command:

```text
wsl -d Ubuntu -- bash -lc "code-server --bind-addr 0.0.0.0:8080"
```

When that command remains running, Windows can reach code-server at:

```text
http://127.0.0.1:8080
```

and `curl.exe -I http://127.0.0.1:8080` returned HTTP 302 to `./login`, proving the Windows-to-WSL route works.

### Automatic launch and embedded handoff — VERIFIED

The automatic launch and embedded handoff are now proven. `server.js` launches or reuses WSL code-server, waits for the local service, and the Code Space UI loads the editor into the dashboard panel.

The current direct WSL command model is:

```text
wsl.exe -d Ubuntu -- bash -lc "exec code-server --bind-addr 0.0.0.0:8080"
```

Verified result:

- Code Space runtime starts successfully on port 8090.
- Start Coding starts or detects code-server on port 8080.
- The embedded editor loads in the lower dashboard panel.
- The loading cover clears and does not trap the user on `Starting Code Space...`.
- The separate-browser fallback still works.

The startup/readiness and embedded-loader debugging phase is complete. Do not reinstall WSL or code-server, and do not reopen the old fullscreen handoff issue without new evidence.

---

# CURRENT MACHINE SERVICES — KEEP SEPARATE

The HP also runs unrelated existing services. Do not confuse these with Code Space or replace them.

Manual restart commands currently used by owner:

```powershell
cd E:\WIZZ-Server
caddy run --config Caddyfile
```

Media server:

```powershell
cd E:\WIZZ-Server\media
npx.cmd http-server -p 8081 -a 127.0.0.1
```

Code Space runtime:

```powershell
cd E:\WIZZ-Server\workspaces\code-space
node server.js
```

These are currently manually managed during development.

---

# NEXT BUILD TARGET

The one-click embedded coding baseline is complete. The next build stage is the real project workflow inside that baseline.

Immediate order:

```text
1. Start Code Space runtime on 8090
2. User creates, opens or clones a real project
3. Show the project in the recent-workspaces dashboard
4. User presses Start Coding / opens that project
5. Load the selected project in the embedded code-server panel
6. User codes normally with editor, terminal and Git available
7. Exit Code Mode returns to the dashboard view
```

Current next priority:

- test the automatic New Project handoff on the HP with a disposable project name
- test Open Existing against a known local folder
- test Clone Repository against a safe repository and confirm the checkout opens in the embedded editor
- keep the dashboard layout and embedded panel intact while adding these flows
- do not change the proven Ubuntu/code-server installation unless evidence requires it

After this loop is proven:

1. project listing/create-folder
2. clone/open flows
3. Git status + safe pull
4. one AI CLI inside the same project working directory
5. minimal Connector integration only later

---

# GIT DIRECTION

Git should be added progressively.

First stage:

```text
status
branch
remote
pull when clean
```

Safety rule:

```text
open workspace
    -> git status
    -> clean? safe pull may run
    -> local changes? DO NOT blind-pull
    -> surface status to user
```

Do not silently commit or push code in the first build.

---

# AI CLI DIRECTION

AI should live **inside the coding environment**, not as a fake browser chat that receives pasted code.

The important architecture is that editor, terminal, Git and AI CLI all work against the same real project folder.

Concept:

```text
project folder
    |
    +-- code-server editor
    +-- terminal
    +-- Git
    +-- AI CLI
```

One AI worker/repo at a time is the preferred development discipline during the current multi-AI experiment.

---

# MEMORY SPACE / CONNECTOR BOUNDARY

Memory Space has **nothing to do with the first Code Space build**.

Do not add Memory Space UI, memory tools, Memory Bridge code or cross-app permissions into Code Space while building the basic coding product.

Later, applications should be able to connect through the minimal Connector layer.

```text
Apps work independently first.
Connector links them later with the smallest useful permission contract.
```

Connector does not move bridge code out of Memory App.

---

# DO NOT DO

Do not:

- modify `999nike/memory-app`
- move existing bridge functionality
- rebuild VS Code/editor functionality
- reinstall WSL/code-server merely because the automatic handoff fails
- disturb Caddy/media services while debugging Code Space
- build a fake chat-based grep IDE
- force Memory Space into Code Space before Code Space works independently
- build Graph or Connector features in this repo
- add dangerous automatic Git push behaviour before status/diff safety exists

---

# GUIDING PRINCIPLE

**Code Space is where the project gets built.**

Use boring, proven engines underneath it and make the surrounding workflow yours.

The wrapper should make code-server, local folders, terminal, Git and AI workers feel like one coherent coding application without rebuilding those tools from scratch.
