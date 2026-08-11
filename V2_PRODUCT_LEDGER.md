# Code Space V2 Product Ledger

**Updated:** 11 Aug 2026 — Dispatch Inbox + safe mock worker lifecycle verified end to end

This is the active build / handoff ledger for:

```text
999nike/code-space
```

Keep this file short, factual and current. Update it after meaningful tested milestones.

---

# AUTHORITATIVE PRODUCT SPLIT

```text
Memory Space
999nike/memory-app
= trusted memory app
= FROZEN
= existing bridges stay there
= do not rebuild, move or refactor its working systems

Office App
= job / worker / dispatch control surface
= creates bounded dispatch packages for workers

Code Space
999nike/code-space
= separate local coding workspace
= receives validated Office dispatch packages
= active development repo for coding execution

Memory Graph / Connector
= later bolt-on apps
```

**Do not modify Memory Space for Code Space work.**

---

# CODE SPACE PURPOSE

Code Space is the coding execution workspace.

Core model:

```text
OFFICE
creates job + worker + permission snapshot
      |
      v
DISPATCH PACKAGE
      |
      v
CODE SPACE DISPATCH INBOX
validate only
      |
      v
EXPLICIT START TASK BOUNDARY
      |
      v
SCOPED WORKER
      |
      v
RESULT / HANDOFF
```

Code Space also remains the local wrapper around code-server:

```text
Code Space shell
      |
      +-- projects
      +-- Dispatch Inbox
      +-- embedded Code Mode
      |
      v
code-server
      |
      +-- real local project folder
      +-- editor
      +-- terminal
      +-- Git
      +-- future AI CLI worker
```

**code-server is the coding engine. Code Space is the wrapper / orchestrator / permission boundary.**

---

# CURRENT VERIFIED STATE

## Embedded Code Space baseline — VERIFIED

On the HP:

- Code Space runtime runs locally on `http://127.0.0.1:8090`.
- code-server runs through WSL Ubuntu on `http://127.0.0.1:8080`.
- Code Space can start/reuse code-server automatically.
- Real project folders open in the embedded code-server panel.
- Dashboard/sidebar/status rail remain visible around the editor.
- Open Separately fallback works.
- Exit Code Mode returns to the dashboard.

Do not reopen the old fullscreen/loader/WSL installation work without new evidence.

---

## Office -> Code Space Dispatch Inbox — VERIFIED 11 Aug 2026

The Office dispatch package boundary has now been manually tested on the HP.

Verified valid package:

```text
Job: Sandbox UI Flow Test
Worker: Test Worker Alpha
Sandbox target: office-app
Package status: Ready
```

Permission snapshot shown correctly:

```text
Read files                 Allowed
Run tests                  Allowed
Propose result / handoff   Allowed
Modify files               Explicitly denied
Use terminal               Not granted
```

Verified behavior:

- valid Office v1 Ready package imports successfully
- package metadata and permissions display correctly
- importing/selecting performs no execution
- accepted package survives browser refresh
- changing package `version` from `1` to `2` is rejected
- rejected v2 package does not disturb the previously accepted package
- validator rejects malformed / incomplete / conflicting capability packages
- `sandboxTarget` remains metadata during import and is not automatically opened or executed

Important commit bringing the locally tested Dispatch Inbox to GitHub:

```text
7545412 — Add validated Dispatch Inbox
```

---

## Safe execution boundary / mock worker lifecycle — VERIFIED 11 Aug 2026

Code Space now has the next safety layer after import.

Added:

- explicit `Start Task (mock)` action
- import/select remains passive
- frozen permission snapshot remains visible before start
- runner receives an allow-list derived only from `capabilities.allowed`
- denied / not-granted capabilities fail closed
- structured task/result records persisted locally
- lifecycle state: `Ready -> Running -> Completed / Failed`
- files inspected / tests run / summary / timestamps / denials / errors fields are available in result state
- mock lifecycle has no filesystem, terminal, command, agent, external-service or Office execution API

For the verified test package the runner grant contained only:

```text
Read files
Run tests
Propose result / handoff
```

It did **not** contain:

```text
Modify files
Use terminal
```

### Automated test result — VERIFIED locally

Command:

```powershell
node --test
```

Result:

```text
9 tests
9 pass
0 fail
```

Tests covered:

- valid Office v1 Ready package
- malformed / contract rejection
- unknown/conflicting capability rejection
- accepted package independence from later source mutation
- persisted passive Running result record
- completion updates same result record
- runner grant exposes only allowed capabilities
- denied/not-granted capabilities fail closed
- mock start contains no execution APIs

`npm test` originally failed because the package script used `node --test test` with the current Node v24 runtime. GitHub was corrected so the script now uses `node --test`.

### Manual browser lifecycle — VERIFIED

Observed on HP:

```text
Ready
  -> Start Task (mock)
Running
  -> Complete mock task
Completed
  -> browser refresh
Completed still present
```

Verified during lifecycle:

- same task ID persisted
- files inspected stayed `0`
- tests run stayed `0`
- runner grant remained limited to the three allowed capabilities
- UI explicitly stated that no files, commands, agents, external services or Office connections were used
- Completed state survived full browser refresh

Current latest safety-layer work is on `main` after the Dispatch Inbox commit.

---

# CURRENT MACHINE / REPO STATE

Code Space repo:

```text
E:\WIZZ-Server\workspaces\code-space
https://github.com/999nike/code-space.git
```

Runtime:

```powershell
cd E:\WIZZ-Server\workspaces\code-space
node server.js
```

Tests:

```powershell
node --test
```

If PowerShell blocks `npm.ps1`, use:

```powershell
npm.cmd test
```

Do not change PowerShell execution policy merely to run npm.

---

# NEXT BUILD TARGET — FIRST REAL WORKER JOURNEY

The no-op boundary is complete and verified.

The next target is **not** another mock. It is the first real, tiny, disposable worker task.

A separate disposable sandbox has been created for this purpose rather than pointing the first worker at Office or Code Space itself.

Use only tiny test code, for example:

```text
agent-sandbox-test/
  math.js
  math.test.js
```

First real task should be approximately:

```text
Read math.js.
Inspect math.test.js.
Run the approved test.
Report what the code does and whether the test passes.
Do not modify any files.
```

Required first real worker permissions:

```text
Read files                 Allowed
Run tests                  Allowed
Propose result / handoff   Allowed
Modify files               Explicitly denied
Use terminal               Not granted
```

Target path:

```text
Office
  -> create tiny sandbox job
  -> assign worker
  -> freeze permissions
  -> export/send dispatch package
Code Space
  -> validate package
  -> user explicitly starts worker
  -> worker reads only sandbox files
  -> worker runs only approved test path
  -> worker cannot modify files
  -> worker returns structured result
  -> task stops
```

**Do not grant Modify files in the first real worker test.**

After the read/test/result loop is proven, a later second disposable test may explicitly grant Modify files for one tiny controlled change.

---

# SECURITY / EXECUTION RULES — KEEP THESE

- importing a dispatch package must never execute it
- selecting a package must never execute it
- execution requires explicit user Start action
- capabilities are an allow-list, not hints
- anything denied or not granted must not be supplied to the runner
- display permission is not enough; enforcement must exist in code
- sandbox target metadata must not become arbitrary filesystem authority
- worker must be constrained to the task sandbox
- no automatic Git push
- no silent permission escalation
- no real worker should gain terminal/filesystem authority merely because code-server itself has those capabilities
- result/handoff is separate from authority to mutate code

---

# DO NOT DO

Do not:

- modify `999nike/memory-app`
- move Memory Bridge functionality
- involve Memory Space in this first worker execution test
- point the first real worker at Office App or Code Space itself
- grant Modify files for the first real test
- grant unrestricted terminal access
- let imported package data directly call Node/filesystem/terminal APIs
- redesign Code Space while proving the worker boundary
- add automatic Git push/merge behavior

---

# GUIDING PRINCIPLE

**Office decides the job. Code Space enforces the job. The worker only gets the capabilities explicitly granted for that task.**

The first real proof is deliberately small: read a disposable file, run one approved test, return a result, stop.
