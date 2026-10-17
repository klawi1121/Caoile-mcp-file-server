/**
 * User Profile Module
 * Implemented by Agent 2 (Builder) following Session 3 blueprint
 */
import { verifyToken } from "./auth";
import { UserPayload } from "./schemas";

export type Role = UserPayload["role"];

export interface UserProfile {
  id: string; // generated, immutable
  username: string; // unique, immutable after creation
  displayName: string;
  email: string;
  role: Role;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface RequestContext {
  token: string;
  actor: UserPayload;
}

export interface CreateProfileInput {
  username: string;
  displayName: string;
  email: string;
  role?: Role; // defaults to "viewer"
}

export interface UpdateProfileInput {
  displayName?: string;
  email?: string;
  role?: Role;
}

export type UserErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: UserErrorCode; message: string; field?: string } };

// ---------- Storage (in-memory only) ----------

const profiles = new Map<string, UserProfile>();
const usernameIndex = new Map<string, string>(); // lowercase username -> id
let idCounter = 0;

// ---------- Helpers ----------

const ROLES: readonly Role[] = ["admin", "editor", "viewer"];
const UPDATABLE_FIELDS: readonly string[] = ["displayName", "email", "role"];
const USERNAME_PATTERN = /^[a-z0-9_]+$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function fail<T>(code: UserErrorCode, message: string, field?: string): Result<T> {
  if (field === undefined) {
    return { ok: false, error: { code, message } };
  }
  return { ok: false, error: { code, message, field } };
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

function generateId(): string {
  idCounter += 1;
  return `usr_${idCounter}`;
}

// Always moves forward so updatedAt differs from the previous value,
// even when two updates land in the same millisecond.
function nextTimestamp(previous?: string): string {
  let now = Date.now();
  if (previous !== undefined) {
    const prev = Date.parse(previous);
    if (!Number.isNaN(prev) && now <= prev) {
      now = prev + 1;
    }
  }
  return new Date(now).toISOString();
}

function authenticate(ctx: RequestContext): boolean {
  return verifyToken(ctx.token);
}

function unauthenticated<T>(): Result<T> {
  return fail<T>("UNAUTHENTICATED", "Invalid or missing token");
}

function validateUsername(value: unknown): string | null {
  if (typeof value !== "string") return "username must be a string";
  if (value.length < 3 || value.length > 32) return "username must be 3-32 characters";
  if (!USERNAME_PATTERN.test(value)) {
    return "username may only contain letters, numbers, and underscores";
  }
  return null;
}

function validateDisplayName(value: unknown): { value: string } | { error: string } {
  if (typeof value !== "string") return { error: "displayName must be a string" };
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 64) {
    return { error: "displayName must be 1-64 characters" };
  }
  return { value: trimmed };
}

function validateEmail(value: unknown): { value: string } | { error: string } {
  if (typeof value !== "string") return { error: "email must be a string" };
  const trimmed = value.trim();
  if (trimmed.length > 254) return { error: "email must be at most 254 characters" };
  if (!EMAIL_PATTERN.test(trimmed)) return { error: "email format is invalid" };
  return { value: trimmed };
}

// ---------- Public API ----------

export function createProfile(ctx: RequestContext, input: CreateProfileInput): Result<UserProfile> {
  // 1. authenticate
  if (!authenticate(ctx)) return unauthenticated();

  // 2. authorize
  const requestedRole: unknown = input.role === undefined ? "viewer" : input.role;
  const actorRole = ctx.actor.role;
  if (actorRole === "viewer") {
    return fail("FORBIDDEN", "Viewers cannot create profiles");
  }
  if (actorRole === "editor" && requestedRole !== "viewer") {
    return fail("FORBIDDEN", "Editors can only create profiles with the viewer role", "role");
  }

  // 3. validate
  const usernameError = validateUsername(input.username);
  if (usernameError !== null) return fail("VALIDATION_ERROR", usernameError, "username");

  const displayName = validateDisplayName(input.displayName);
  if ("error" in displayName) return fail("VALIDATION_ERROR", displayName.error, "displayName");

  const email = validateEmail(input.email);
  if ("error" in email) return fail("VALIDATION_ERROR", email.error, "email");

  if (!isRole(requestedRole)) {
    return fail("VALIDATION_ERROR", "role must be admin, editor, or viewer", "role");
  }

  // 4. conflict check
  const key = input.username.toLowerCase();
  if (usernameIndex.has(key)) {
    return fail("CONFLICT", "username is already taken", "username");
  }

  // 5. mutate
  const timestamp = nextTimestamp();
  const profile: UserProfile = {
    id: generateId(),
    username: input.username,
    displayName: displayName.value,
    email: email.value,
    role: requestedRole,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  profiles.set(profile.id, profile);
  usernameIndex.set(key, profile.id);
  return ok({ ...profile });
}

export function getProfile(ctx: RequestContext, id: string): Result<UserProfile> {
  if (!authenticate(ctx)) return unauthenticated();
  // every role may read
  const profile = profiles.get(id);
  if (!profile) return fail("NOT_FOUND", "Profile not found");
  return ok({ ...profile });
}

export function updateProfile(
  ctx: RequestContext,
  id: string,
  patch: UpdateProfileInput
): Result<UserProfile> {
  // 1. authenticate
  if (!authenticate(ctx)) return unauthenticated();

  // 2. authorize
  const patchRecord: Record<string, unknown> = { ...patch };
  const actorRole = ctx.actor.role;
  const touchesRole = patchRecord["role"] !== undefined;

  if (touchesRole && actorRole !== "admin") {
    return fail("FORBIDDEN", "Only admins can change roles", "role");
  }
  if (actorRole === "viewer") {
    // Viewers may only edit their own profile. A missing target is reported
    // as FORBIDDEN too, so viewers cannot probe which ids exist.
    const target = profiles.get(id);
    if (!target || target.username.toLowerCase() !== ctx.actor.username.toLowerCase()) {
      return fail("FORBIDDEN", "Viewers can only update their own profile");
    }
  }

  // 3. validate
  const keys = Object.keys(patchRecord);
  const unknownKey = keys.find((k) => !UPDATABLE_FIELDS.includes(k));
  if (unknownKey !== undefined) {
    return fail("VALIDATION_ERROR", `Field "${unknownKey}" cannot be updated`, unknownKey);
  }
  const knownKeys = keys.filter((k) => patchRecord[k] !== undefined);
  if (knownKeys.length === 0) {
    return fail("VALIDATION_ERROR", "patch must contain at least one updatable field");
  }

  let newDisplayName: string | undefined;
  let newEmail: string | undefined;
  let newRole: Role | undefined;

  if (patchRecord["displayName"] !== undefined) {
    const result = validateDisplayName(patchRecord["displayName"]);
    if ("error" in result) return fail("VALIDATION_ERROR", result.error, "displayName");
    newDisplayName = result.value;
  }
  if (patchRecord["email"] !== undefined) {
    const result = validateEmail(patchRecord["email"]);
    if ("error" in result) return fail("VALIDATION_ERROR", result.error, "email");
    newEmail = result.value;
  }
  if (touchesRole) {
    const roleValue = patchRecord["role"];
    if (!isRole(roleValue)) {
      return fail("VALIDATION_ERROR", "role must be admin, editor, or viewer", "role");
    }
    newRole = roleValue;
  }

  // 4. existence
  const existing = profiles.get(id);
  if (!existing) return fail("NOT_FOUND", "Profile not found");

  // 5. mutate (id and username are never touched)
  const updated: UserProfile = {
    ...existing,
    displayName: newDisplayName ?? existing.displayName,
    email: newEmail ?? existing.email,
    role: newRole ?? existing.role,
    updatedAt: nextTimestamp(existing.updatedAt),
  };
  profiles.set(id, updated);
  return ok({ ...updated });
}

export function deleteProfile(ctx: RequestContext, id: string): Result<{ id: string }> {
  if (!authenticate(ctx)) return unauthenticated();
  if (ctx.actor.role !== "admin") {
    return fail("FORBIDDEN", "Only admins can delete profiles");
  }
  const existing = profiles.get(id);
  if (!existing) return fail("NOT_FOUND", "Profile not found");
  profiles.delete(id);
  usernameIndex.delete(existing.username.toLowerCase());
  return ok({ id });
}

/** Test helper: clears the in-memory store and id counter. */
export function resetUserStore(): void {
  profiles.clear();
  usernameIndex.clear();
  idCounter = 0;
}
