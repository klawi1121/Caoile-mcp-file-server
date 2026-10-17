# Architectural & Engineering Decisions

## Decision Record

### ADR-001: Sandboxed Root Enforcement
- **Context**: File-server allows autonomous agents to modify files on host system.
- **Decision**: Resolve all paths strictly inside `WORKSPACE_ROOT`. Reject path traversal (`../`, `..\`, null bytes, drive roots).
- **Consequences**: Safe execution without danger of wiping host disk or reading sensitive host credentials.

### ADR-002: Line Chunking on File Reads
- **Context**: Autonomous agents often read whole 5000+ line files, blowing token windows.
- **Decision**: Default line caps at 200 lines, hard cap at 500 lines per tool call.
- **Consequences**: High agent efficiency score, reduced API costs.

### ADR-003: Structured Handoff Over In-Memory Chat History
- **Context**: Agent sessions have finite context windows; context degradation occurs over long conversations.
- **Decision**: Rely on physical markdown handoff files (`PROJECT_STATE`, `PLAN_LOG`, `CHECKPOINTS`, `DECISIONS`) stored in workspace.
- **Consequences**: Completely seamless cross-session persistence across different models and agents.

### ADR-004: Counter-Based IDs for User Profiles
- **Context**: Session 3 plan allowed `crypto.randomUUID()` or a counter-based id. The workspace has no tsconfig or typings, so `crypto` may not type-check under strict TS.
- **Decision**: `src/user.ts` uses a module-private counter (`usr_1`, `usr_2`, ...), reset by `resetUserStore()`.
- **Consequences**: No runtime or typings dependency and deterministic IDs for tests. IDs are guessable and not unique across restarts. Swap to UUIDs when persistence is added.

### ADR-005: Test Approach for User Module (gap noted)
- **Context**: Plan section 10 suggests checks, but no test framework exists in the workspace and the Builder had file-server tools only (no way to run code).
- **Decision**: Implemented to the spec without executing it. The section 10 scenarios are NOT yet verified at runtime.
- **Consequences**: Follow-up: run those 7 scenarios with a throwaway script or vitest. Viewer updates on a missing id return FORBIDDEN (not NOT_FOUND) so viewers cannot probe which ids exist.