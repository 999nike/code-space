# Code Space V2 Product Ledger

**Updated:** 12 Aug 2026 — Codex worker queue implemented; live Codex sandbox proof awaits explicit data-egress approval

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

## HARD UI / RUNTIME RULES

- Worker App startup opens Office and Code Space once. Code Space claims the `code-space` browsing-context name during initial page parsing.
- Office dispatch reuses that existing Code Space browsing context and must never create duplicates, transient `about:blank` tabs, or restart services.

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

# CURRENT IMPLEMENTED STATE

- The deterministic read/test worker and fixed write test worker remain available for their original test purposes.
- An explicit Codex route exists: a frozen package with `worker.id = builtin:codex` (or the legacy `worker.name = Codex` fallback) can call it. It is restricted to `agent-sandbox-test`, passes the frozen instructions through stdin to ephemeral non-interactive `codex exec`, ignores user config, disables plugins, skips only the sandbox Git-repository check, selects `read-only` or `workspace-write` from `modifyFiles`, and persists stdout/stderr/exit status. A server-side lock rejects concurrent Codex execution.
- Code Space now has a persistent browser-local ordered Codex queue. Imported Codex packages enter it without executing; one batch `Authorise & Start queue` runs one package at a time. Results persist, read-only ordinary failures may continue, and write-capable or safety/permission failures pause as `Failed`/`Blocked`. Queue ordering, pause, and stop are available; no Git automation exists.
- Focused and batched local tests pass. The first live invocation revealed that terminal-denied Codex had no mediated file input; that input is now implemented and the single repeat proof is ready when explicitly authorised.

## Office built-in Codex identity — 12 Aug 2026 — IMPLEMENTED, LIVE PROOF PENDING

Office now sends its first-class built-in Codex selection as the existing package v1 worker identity:

```text
worker.id:   builtin:codex
worker.name: Codex
worker.role: Built-in coding model
```

Code Space routing now prefers `worker.id = builtin:codex` and preserves the previous `worker.name = Codex` comparison as a compatibility fallback for older packages. No package format changed, and queue/authorisation behavior remains unchanged.

Phase A does not expose a general terminal capability. The fixed server-side `codex exec` launcher is itself sandbox-mediated; it accepts a frozen Codex package with `Read files` and `Propose result / handoff` allowed while `Use terminal` remains not granted, and rejects an explicit terminal grant. `Run tests` remains a separate optional frozen capability. Office does not auto-grant any capability.

The initial live read-only proof was run on 12 Aug 2026. Code Space accepted a frozen `builtin:codex` package and Codex executed in `read-only` mode with exit status 0; no files were changed and no tests were run. It correctly reported that no files could be inspected because the terminal-denied route then had no separate file input.

That blocker is now fixed. Only inside `runCodexDispatchTask`, after `readFiles` and the exact `agent-sandbox-test` root have been validated, Code Space reuses its bounded direct-file reader. It accepts supported direct regular files only, rejects separators/dot names and resolved paths outside the sandbox, applies existing per-file bounds plus a 128 KiB total Codex prompt cap, and presents the selected contents as explicitly delimited untrusted project data. No file-read HTTP endpoint, shell endpoint, recursive path access, `modifyFiles`, `runTests`, or `useTerminal` grant is added. The structured Codex result persists the supplied file manifest.

## Phase A real Codex read-only proof — VERIFIED 12 Aug 2026

Code Space accepted one Office-built `builtin:codex` package with Read files and Propose result / handoff allowed while Modify files, Run tests, and Use terminal remained not granted. The mediated snapshot contained `agent-write-test.txt`, `math.js`, and `math.test.js`; Codex described all three correctly. It ran in `read-only` mode, exited 0, made no changes, ran no tests, and reported no terminal commands. This completes the Phase A live proof.

---

# TARGET OPERATING MODEL — NOT YET BUILT

The target is a short Office planning session that creates roughly 5–10 ordered Codex jobs, then lets Worker App execute the safe queue while the user is away for review later.

```text
User -> Office jobs + Codex + project + frozen permissions -> ordered queue
     -> Code Space validates -> one Codex job at a time -> persisted result/error
     -> next independent safe job -> later Office batch review
```

Rules for this target:

- Office is job authority; Code Space is the execution/security boundary; Codex is only the coding worker.
- Each Codex run receives only its approved project, instructions, and capabilities. Frozen permissions remain authoritative; no unrestricted machine or terminal authority is implied.
- No automatic Git commit, push, or merge. Memory Space remains frozen. Real/core projects stay excluded until stable sandbox Codex execution is proven and the user explicitly authorises expansion.
- Failed or risky work records useful `Failed`/`Blocked` output without escalating permissions. Independent safe jobs may continue only when doing so cannot compound the failure.
- Queue execution must not require manual clicks for every small patch/test cycle. Build meaningful chunks, batch automated verification after substantial progress, diagnose/fix failures, then return to meaningful chunks; avoid patch/test loops unless an immediate safety boundary requires one.
- Browser ownership is permanent: Worker App startup opens Office and Code Space once; Office dispatch reuses the existing Code Space browsing context and must never create duplicates.

## Near-term build order

1. Obtain explicit approval and prove one live read-only Codex sandbox run; then stabilise its persisted live result.
2. Keep Office worker selection as the explicit Codex routing signal and prove the Office-to-queue handoff end to end.
3. Add unresolved-dependency and richer safety classification before allowing automatic continuation beyond read-only work.
4. Add Office batch review for persisted `Completed`, `Failed`, and `Blocked` queue results.
5. Only then permit explicitly authorised real projects.

## First queue constraints

- One Codex job runs at a time; no parallel project mutation.
- Completion advances automatically. Ordinary failure may advance to the next independent safe job; permission/safety failure blocks that job and cannot be bypassed automatically.
- The user can pause or stop the queue. No automatic Git operations are ever added.

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
