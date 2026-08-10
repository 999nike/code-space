# Code Space

Code Space is a local-first coding workspace shell built around **code-server**.

The app owns the project dashboard, workspace shortcuts, launch flow and future orchestration. `code-server` remains the actual coding engine for editor, terminal, extensions and project filesystem access.

## Current build

- Code Space dashboard / wrapper UI
- New Project, Clone Repository and Open Existing workspace registration
- recent workspace list stored locally in the browser
- configurable local `code-server` address
- full-screen **Code Mode** takeover using code-server
- return from Code Mode to the Code Space dashboard
- responsive desktop/mobile shell

The current project forms record project locations and repository URLs. They do **not** yet create folders or run `git clone`; that requires the local runtime layer that will be added next.

## Direction

```text
Code Space
    |
    +-- project dashboard
    +-- local workspace registry
    +-- code-server launch / full-screen Code Mode
    +-- real project folders
    +-- terminal
    +-- Git
    +-- AI CLI workers
```

Memory Space is not part of the first Code Space build. Cross-app connection can be added later through the minimal Connector contract.
