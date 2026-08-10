# Code Space V2 Product Ledger

**Updated:** 10 Aug 2026 — startup handoff hardening

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
FULL-SCREEN CODE MODE
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

The wrapper is for project selection, status and orchestration.

When actual coding starts, **code-server takes over the full screen** rather than being permanently squeezed into half of the dashboard.

```text
Code Space Home
     |
     | Start Coding / Open project
     v
Code Space starts local code-server if needed
     |
     v
Full-screen code-server
     |
     | Exit Code Mode
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
- configurable code-server URL
- code-server target `http://127.0.0.1:8080`
- code-server reachability check
- full-screen Code Mode wrapper
- Open Separately fallback
- Exit Code Mode returns to dashboard
- Git/runtime status support
- one-click Start Coding route now attempts to launch code-server automatically

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

### Current integration state — NEARLY WORKING

The remaining problem is specifically the automatic launch/handoff from the Code Space Node runtime to WSL code-server.

The previous `cmd.exe` launcher layer was removed. Current `server.js` now launches WSL directly using the proven command model:

```text
wsl.exe -d Ubuntu -- bash -lc "exec code-server --bind-addr 0.0.0.0:8080"
```

Latest integration commit before this ledger update:

```text
0d96a46
Direct WSL launch from server.js
```

Observed current behaviour after that patch:

- Code Space runtime starts successfully on port 8090.
- Start Coding enters the Code Mode loading screen.
- a WSL/code-server console is visibly spawned.
- that console reports code-server 4.132.0 running and listening on `0.0.0.0:8080`.
- Code Space still remains on `Starting Code Space...` instead of completing the transition.

This is significant progress: **automatic process launch is now visibly occurring.**

Do not reinstall WSL or code-server again. The engine itself is proven working.

Next debugging target is only the readiness/reachability handoff between the spawned WSL process and `server.js`.

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

Finish the one-click coding startup path before adding more features.

Immediate order:

```text
1. Start Code Space runtime on 8090
2. User presses Start Coding
3. Node launches Ubuntu WSL code-server
4. Detect when code-server is actually reachable
5. Switch wrapper into full-screen code-server
6. User codes normally
7. Exit Code Mode returns to dashboard
```

Current debugging priority:

- launcher now starts code-server as a detached WSL service and waits for an HTTP response (not only a TCP socket)
- failed starts preserve a WSL log at `/tmp/code-space-code-server.log` and return the exact command to inspect it
- concurrent start requests share one startup attempt instead of racing each other
- test the updated one-click path on the HP before adding features
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
