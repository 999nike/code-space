# Code Space V2 Product Ledger

**Updated:** 11 Aug 2026 — first real mediated Office -> Code Space read/test worker verified end to end

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
= job / worker / permission / dispatch control surface
= discovers project names from Code Space
= creates bounded dispatch packages

Code Space
999nike/code-space
= separate local coding workspace
= owns real workspace folders
= validates Office dispatch packages
= enforces execution capabilities

Memory Graph / Connector
= later bolt-on apps
```

**Do not modify Memory Space for Code Space work.**

---

# PRODUCT FLOW

```text
OFFICE
creates job + worker + permission snapshot
      |
      v
READY DISPATCH PACKAGE
      |
      v
CODE SPACE DISPATCH INBOX
validate + display only
      |
      v
EXPLICIT START TASK
      |
      v
MEDIATED WORKER BOUNDARY
      |
      v
SCOPED FILE READ / APPROVED TEST
      |
      v
STRUCTURED RESULT / HANDOFF
```

Guiding principle:

**Office decides the job. Code Space enforces the job. The worker only gets capabilities explicitly granted for that task.**

---

# CURRENT VERIFIED STATE

## Code Space runtime / code-server — VERIFIED

HP runtime:

```text
Code Space:   http://127.0.0.1:8090
code-server:  http://127.0.0.1:8080
Workspaces:   E:\WIZZ-Server\workspaces
Engine:       Ubuntu WSL
```

Code Space remains the wrapper / orchestrator / permission boundary around code-server.

---

## Dynamic Office project catalog — VERIFIED 11 Aug 2026

Office no longer depends on a hard-coded project list.

Code Space now owns workspace discovery through:

```text
GET /api/office/projects
```

Verified behavior:

- reads direct folders only from `E:\WIZZ-Server\workspaces`
- returns safe project-name metadata only
- excludes the Code Space app folder itself
- exact local Office CORS origin is `http://127.0.0.1:4176`
- Office disables project selection/job creation if Code Space project discovery is unavailable
- Office validates new jobs against the current discovered catalog
- new folders appear without changing Office code

Manual browser verification showed projects including:

```text
agent-sandbox-test
junkz-shooter-landing
memory-app
office-app
Smokey-Space
space-junkz-shooter
```

`code-space` was correctly excluded.

Local tests after this patch:

```text
Office:     29 / 29 pass
Code Space: 10 / 10 pass
```

Catalog work was committed/pushed after local verification.

---

## Dispatch Inbox validation — VERIFIED

Office v1 Ready packages are validated before execution.

Verified permission snapshot for the first worker journey:

```text
Read files                 Allowed
Run tests                  Allowed
Propose result / handoff   Allowed
Modify files               Explicitly denied
Use terminal               Not granted
```

Verified behavior:

- valid package imports successfully
- import/select is passive and does not execute
- accepted package persists across refresh
- unsupported package version is rejected
- malformed, incomplete, conflicting or unknown capability packages fail closed
- sandbox target is validated metadata, not arbitrary path authority

---

# FIRST REAL MEDIATED WORKER — VERIFIED 11 Aug 2026

Disposable target:

```text
E:\WIZZ-Server\workspaces\agent-sandbox-test
```

Office job:

```text
Agent Sandbox Read Test
```

Instruction:

```text
Read the files in agent-sandbox-test, run the approved test,
report what the code does and whether the test passes.
Do not modify any files.
```

Worker:

```text
Test Worker Alpha — Coding Worker
```

Frozen package permissions:

```text
Read files                 Allowed
Run tests                  Allowed
Propose result / handoff   Allowed
Modify files               Explicitly denied
Use terminal               Not granted
```

## Real execution boundary implemented

Code Space now has a first real mediated read/test slice.

It does **not** expose a general terminal, arbitrary shell command, writable filesystem object, network authority, Office authority or AI provider API to the worker.

Current boundary:

- resolves only one direct named sandbox under the approved workspace root
- rejects path traversal / nested arbitrary paths
- reads only bounded direct readable code/text files
- runs only a detected direct `*.test.js`, `*.test.cjs` or `*.test.mjs`
- test invocation is fixed to Node using `execFile` / `node --test`
- no shell is granted
- no arbitrary command string is accepted
- `modifyFiles` must remain explicitly denied
- `useTerminal` must remain denied/not granted
- result/handoff is structured and persisted separately from mutation authority

## Automated tests — VERIFIED locally

Command:

```powershell
node --test
```

Result:

```text
13 tests
13 pass
0 fail
```

Coverage includes:

- Office package validation
- conflicting/unknown capability rejection
- immutable accepted snapshot behavior
- read-only worker grant enforcement
- direct sandbox resolution only
- direct file inspection
- fixed approved Node test execution
- passive/persisted result lifecycle
- denied/not-granted fail closed
- dynamic Office project catalog

## Manual first real run — VERIFIED

The imported Ready package was started with:

```text
Start Task (read/test)
```

Observed result:

```text
Status:          Completed
Files inspected: 2
Tests run:       1
Files:           math.js, math.test.js
Test:            node --test math.test.js — PASS
Code summary:    function add detected
Handoff:         approved Node test passed
```

The persisted result confirmed:

- actual sandbox files were read
- the approved test was actually executed
- no file-modification capability was granted
- no terminal capability was granted
- a structured result / handoff was returned

This proves the first real Office -> Code Space execution loop:

```text
Office job
  -> Ready package
  -> export JSON
  -> Code Space import/validation
  -> explicit Start Task
  -> sandbox read
  -> approved test execution
  -> structured handoff
  -> Completed
```

---

# COMPLETED TASK SAFETY — VERIFIED UI PATCH

After the first successful real run, Code Space was tightened so a Completed task is not accidentally rerun.

Current UI behavior:

```text
Ready   -> Start Task (read/test)
Running -> Task running…
Completed -> Task completed  [disabled]
Failed  -> Retry Task (read/test)
```

This preserves the explicit execution boundary and prevents accidental duplicate execution after completion.

---

# SECURITY / EXECUTION RULES — KEEP THESE

- importing a dispatch package must never execute it
- selecting a package must never execute it
- execution requires explicit user Start action
- capabilities are code-enforced allow-lists, not hints
- denied or not-granted capabilities must not be supplied to the worker
- Code Space resolves sandbox paths server-side from the approved workspace root
- no arbitrary path from package/client becomes filesystem authority
- Run tests does not imply general terminal access
- first worker test uses a dedicated approved-test capability, not a shell
- result/handoff does not imply authority to mutate project files
- no automatic Git push / merge
- no silent permission escalation
- do not point experimental workers at Memory Space

---

# CURRENT MACHINE / REPO STATE

Repo:

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

If PowerShell blocks `npm.ps1`, use `npm.cmd test`; do not change execution policy just for npm.

---

# NEXT TARGET

The read/test/result execution boundary is now proven.

The next major decision is how the **actual AI coding worker** is connected behind this boundary.

Do not confuse the current mediated worker with an AI model: the current worker performs real filesystem reads and approved test execution, but its code summary is deterministic/local and no Codex/Claude/Grok worker has yet been attached.

Before adding an AI worker, preserve the same capability model:

```text
Office package
  -> Code Space validated grant
  -> scoped mediated capabilities only
  -> AI receives observations/results, not raw unrestricted machine authority
```

A later controlled mutation test may grant `Modify files` for one disposable task, but only after its write boundary is explicitly designed and tested.

---

# DO NOT DO

Do not:

- modify `999nike/memory-app`
- move Memory Bridge functionality
- grant unrestricted terminal access to the worker
- give imported package data direct Node/filesystem/child-process authority
- let Run tests silently become shell access
- redesign Code Space while proving the worker boundary
- add automatic Git push/merge behavior
- call the current deterministic read/test worker an AI agent

---

# MILESTONE

**11 Aug 2026: first real Office -> Code Space bounded worker execution proven end to end on the HP.**

A Ready Office job successfully became a validated Code Space task that read two disposable sandbox files, ran one approved Node test, produced a persisted structured handoff, and completed without file-modification or terminal authority.
