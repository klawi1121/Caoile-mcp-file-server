# Plan Log
## Objectives
- [x] Task 1: Audit requirements and produce architecture specification (Completed by Architect)
- [ ] Task 2: Implement core token verification logic in src/auth.ts (Assigned to Builder)
- [ ] Task 3: Add input validation schemas in src/schemas.ts (Assigned to Builder)
- [ ] Task 4: Verify working tree status and produce checkpoint commit (Assigned to Builder)
## Architecture Blueprint (Session 1 Output)
- File to Create: `src/auth.ts` -> implements `verifyToken(token: string): boolean`
- File to Create: `src/schemas.ts` -> exports user login schema
- Handoff status: Ready for Builder execution in Session 2

---

## Session 3: User Profile Module (Planner: Agent 1 / System Architect)

> Note: Tasks 2-4 above are still unchecked, but CHECKPOINTS.md (CP-001) and the existing `src/auth.ts` / `src/schemas.ts` show they were delivered by Agent 2. Left as-is for the Builder / Supervisor to tick off. This session builds on those files.

- [ ] Task 5: Implement user profile module in `src/user.ts` (Assigned to Builder, Agent 2)
- [ ] Task 6: Add `UserProfile`-related types to `src/schemas.ts` only if shared types are needed (see Type Placement). Default is to keep them in `src/user.ts`.
- [ ] Task 7: Verify with `git_status`, then commit and add checkpoint CP-002 in CHECKPOINTS.md (Assigned to Builder)

### 1. Goal
Provide a small, dependency-free user profile module that supports creating, reading, updating, and deleting profiles, gated by the existing token check and role model.

### 2. Existing Code to Reuse (do NOT redefine)
- `verifyToken(token: string): boolean` from `src/auth.ts`. It only returns a boolean and does not identify the user.
- `UserPayload { username: string; role: "admin" | "editor" | "viewer" }` from `src/schemas.ts`.

### 3. Key Design Constraint
`verifyToken` does not say who the caller is. So every operation takes an explicit `ctx` object: `{ token: string; actor: UserPayload }`. The module checks `verifyToken(ctx.token)` first, then applies role rules using `ctx.actor`. Binding a token to an identity is out of scope and is logged as a follow-up.

### 4. Public Contract (signatures only, no implementation)
```ts
import { UserPayload } from "./schemas";

export type Role = UserPayload["role"];

export interface UserProfile {
  id: string;            // generated, immutable
  username: string;      // unique, immutable after creation
  displayName: string;
  email: string;
  role: Role;
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
}

export interface RequestContext { token: string; actor: UserPayload; }

export interface CreateProfileInput { username: string; displayName: string; email: string; role?: Role; } // role defaults to "viewer"
export interface UpdateProfileInput { displayName?: string; email?: string; role?: Role; }                 // username/id never updatable

export type UserErrorCode =
  | "UNAUTHENTICATED"   // verifyToken failed
  | "FORBIDDEN"         // role not allowed for this action
  | "VALIDATION_ERROR"  // bad field values
  | "NOT_FOUND"
  | "CONFLICT";         // duplicate username

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: UserErrorCode; message: string; field?: string } };

export function createProfile(ctx: RequestContext, input: CreateProfileInput): Result<UserProfile>;
export function getProfile(ctx: RequestContext, id: string): Result<UserProfile>;
export function updateProfile(ctx: RequestContext, id: string, patch: UpdateProfileInput): Result<UserProfile>;
export function deleteProfile(ctx: RequestContext, id: string): Result<{ id: string }>;
export function resetUserStore(): void; // test helper, clears the in-memory store
```
Functions return `Result<T>` and never throw for expected failures.

### 5. Storage
- Module-private `Map<string, UserProfile>` keyed by `id`, plus a secondary `Map<string, string>` of lowercase username -> id for uniqueness.
- In-memory only. No file or DB persistence this session.
- ID generation: `crypto.randomUUID()` if the target runtime supports it, else a simple counter-based id. Builder should pick one and note it in DECISIONS.md.
- Timestamps via `new Date().toISOString()`.
- Return copies (`{ ...profile }`) so callers cannot mutate the store.

### 6. Validation Rules
- `username`: 3-32 chars, `/^[a-z0-9_]+$/i`, stored as given, uniqueness checked case-insensitively.
- `displayName`: trimmed, 1-64 chars.
- `email`: trimmed, basic shape check `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, max 254 chars.
- `role`: must be one of `"admin" | "editor" | "viewer"`.
- `patch` must contain at least one known field, otherwise `VALIDATION_ERROR`. Unknown keys are rejected.
- Order of checks: authenticate -> authorize -> validate -> existence/conflict -> mutate.

### 7. Authorization Matrix
| Action | admin | editor | viewer |
| :--- | :--- | :--- | :--- |
| createProfile | yes (any role) | yes (role must be `viewer`) | no |
| getProfile | yes | yes | yes |
| updateProfile (displayName, email) | yes | yes | only own profile (`actor.username` equals target username) |
| updateProfile (role) | yes | no | no |
| deleteProfile | yes | no | no |

An invalid token always returns `UNAUTHENTICATED` before any role check.

### 8. File Layout and Type Placement
- Create `src/user.ts` only. Keep all new types inside it.
- Import from `./auth` and `./schemas` using the existing relative-path style.
- Do not modify `src/auth.ts`. Only touch `src/schemas.ts` if a type truly must be shared.
- Add a header comment matching the existing style, e.g. `Implemented by Agent 2 (Builder) following Session 3 blueprint`.

### 9. Acceptance Criteria
1. `src/user.ts` compiles under strict TypeScript with no `any`.
2. All five exports exist with the signatures in section 4.
3. Every operation calls `verifyToken` first.
4. The authorization matrix in section 7 is enforced.
5. Duplicate usernames (case-insensitive) return `CONFLICT`.
6. `username` and `id` cannot change via `updateProfile`.
7. Returned profiles are copies, not store references.
8. `updatedAt` changes on update and `createdAt` does not.

### 10. Suggested Verification (Builder)
Test tokens must pass `verifyToken` (start with `bearer_`, length 16 or more, no "expired"). Check at minimum:
- bad or short token -> `UNAUTHENTICATED`
- viewer create -> `FORBIDDEN`
- editor creating an `admin` -> `FORBIDDEN`
- duplicate username in different case -> `CONFLICT`
- viewer updating own profile OK, another profile `FORBIDDEN`
- update with an empty patch -> `VALIDATION_ERROR`
- get/delete unknown id -> `NOT_FOUND`
No test framework exists in the workspace yet. A small throwaway script is fine, or note the gap in DECISIONS.md.

### 11. Risks and Open Items
- `verifyToken` is a stub (prefix and length check only) and the token is not tied to `actor`. A caller could pass a valid token with a spoofed `actor`. Accepted for this demo, flagged for a future auth task.
- In-memory store resets on restart.
- Out of scope: password handling, persistence, pagination or listing, avatar upload, HTTP layer.

### 12. Builder Handoff Checklist
- [ ] Read this section and PROJECT_STATE.md before writing code
- [ ] Implement `src/user.ts` per sections 4-8
- [ ] Run verification from section 10
- [ ] Run `git_status`, then `git_commit` with a clear message
- [ ] Append CP-002 to CHECKPOINTS.md and record any decisions (ID strategy, test approach) in DECISIONS.md
- [ ] Update PROJECT_STATE.md when done

- Handoff status (Session 3): Planning complete. Ready for Agent 2 (Builder) to implement `src/user.ts`.
