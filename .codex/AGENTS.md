# ~/.codex/AGENTS.md

## Working agreements
- Keep going until tests pass ("green") before you stop.
- Summarize changes at the end (files changed + commands run).
- Don't run destructive commands (rm, dd, mkfs, shutdown/reboot, chmod -R, etc.). If you think it's necessary, ask first.
- Ask before using the network (curl/wget, package installs, git push/pull, etc.).
- Prefer minimal command runs (targeted tests first, then full suite before finishing).
