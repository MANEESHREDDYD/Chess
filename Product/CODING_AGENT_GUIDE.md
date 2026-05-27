# Coding Agent Guide

**CRITICAL: CANONICAL WORKSPACE**

The canonical path for this project is:
`C:\Users\md200\OneDrive\Desktop\Chess\Product`

All code generation, modifications, and command execution MUST happen in this directory.

The root directory (`C:\Users\md200\OneDrive\Desktop\Chess`) may contain archives (e.g., `_archive_bundle`), but they are stale duplicates. Do NOT modify them.

**LOCKED DEPENDENCIES**
All dependency versions in `package.json` are strictly pinned without carets (`^`) or tildes (`~`). Do not upgrade or bump dependencies unless explicitly told to do so. If installing a new package, use `--save-exact` to maintain this strict pinning.

**STARTING WORK**
When you start a new task:
1. Ensure your current working directory is `Product/`.
2. Check `docs/v4_implementation.html` and `docs/agent_briefs/` for your assigned task constraints.
3. Use the locked versions exactly as specified in `package.json`.
