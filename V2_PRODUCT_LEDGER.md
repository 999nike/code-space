# Code Space V2 Product Ledger

**Updated:** 10 Aug 2026

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
     | Open project / Enter Code Mode
     v
Full-screen code-server
     |
     | Exit Code Mode
     v
Code Space Home
```

This gives code-server maximum screen space on desktop, Dex, laptop and mobile while preserving the Code Space product shell around it.

---

# CURRENT IMPLEMENTED STATE

Initial Code Space shell committed on 10 Aug 2026.

Implemented:

- responsive Code Space wrapper/dashboard
- Quick Start cards
- New Project workspace registration
- Clone Repository workspace registration
- Open Existing workspace registration
- local browser persistence for project shortcuts
- recent workspace list
- recent activity list
- configurable code-server URL
- default local address `http://127.0.0.1:8080`
- code-server reachability check
- full-screen Code Mode
- code-server iframe launch path
- Open Separately fallback
- Exit Code Mode returns to dashboard
- README documents current architecture

Important limitation:

The current browser shell only **records** project names, paths and repository URLs. It does not yet have a privileged local runtime capable of creating folders, cloning repositories, running Git or starting processes.

That boundary is deliberate. Browser JavaScript alone should not pretend it can safely manipulate arbitrary local folders.

---

# NEXT BUILD TARGET — LOCAL RUNTIME

The next meaningful layer is a small local Code Space runtime/helper that gives the browser shell controlled access to approved workspace operations.

Target capabilities, one at a time:

```text
1. inspect configured workspace root
2. list projects
3. create project folder
4. register/open existing approved folder
5. clone Git repository into workspace root
6. check Git status
7. safe pull only when working tree is clean
8. launch/open code-server against selected folder
```

Do not start with autonomous write/commit/push behaviour.

### Workspace root

A likely development root on the HP machine is:

```text
E:\WIZZ-Server\workspaces\
```

The runtime should eventually be configurable, but all file operations must remain inside explicitly approved workspace roots.

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

Later stages may add controlled:

- diff
- commit
- push
- branch creation

Do not silently commit or push code in the first build.

---

# AI CLI DIRECTION

AI should live **inside the coding environment**, not as a fake browser chat that receives pasted code.

The important architecture is that editor, terminal, Git and AI CLI all work against the same real project folder.

Possible workers later include whichever CLI/API tools actually support the workflow at the time.

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

The intended future principle is:

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
- build a fake chat-based grep IDE
- dump whole repositories into model context as the core workflow
- force Memory Space into Code Space before the coding environment works independently
- build Graph or Connector features in this repo
- add dangerous automatic Git push behaviour before status/diff safety exists
- pretend browser-only code can manipulate arbitrary local files without a local runtime

---

# IMMEDIATE WORK ORDER

1. Run/deploy the current Code Space shell and inspect the real UI.
2. Adjust the visual shell against the approved Code Space concept image.
3. Verify full-screen Code Mode against the user's existing local code-server.
4. Decide the smallest local runtime API needed to manage `E:\WIZZ-Server\workspaces` safely.
5. Implement project listing / create-folder first.
6. Add clone/open flows.
7. Add Git status + safe pull.
8. Add one AI CLI inside the same project working directory.
9. Only after the coding loop is useful, consider minimal Connector integration.

---

# GUIDING PRINCIPLE

**Code Space is where the project gets built.**

Use boring, proven engines underneath it and make the surrounding workflow yours.

The wrapper should make code-server, local folders, terminal, Git and AI workers feel like one coherent coding application without rebuilding those tools from scratch.
