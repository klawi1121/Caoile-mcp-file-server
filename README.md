# Caoile MCP File-Server Connector

---

## 📌 Table of Contents

1. [Overview & Project Rationale](#-overview--project-rationale)
2. [System Architecture](#-system-architecture)
3. [Tool Catalog (9 Custom MCP Tools)](#-tool-catalog-9-custom-mcp-tools)
4. [Project Structure](#-project-structure)
5. [Multi-Agent Handoff Protocol](#-multi-agent-handoff-protocol)
6. [Fresh Device Setup & Migration Guide](#-fresh-device-setup--migration-guide)
7. [Testing & Verification](#-testing--verification)

---

## Overview & Project Rationale

The **Caoile MCP File-Server** is a production-grade, sandboxed filesystem connector built on the official **Model Context Protocol (MCP)** specification by Anthropic.

### Why build this?
Autonomous LLM agents (such as Claude, Cursor, or custom agents) present two fundamental engineering challenges when interacting directly with a host machine:
1. **Security Vulnerabilities (Arbitrary File Access)**: Granting an autonomous agent unrestricted filesystem access exposes the host system to destructive actions and directory traversal exploits (`../../etc/passwd`, `C:\Windows\System32`, personal directories, credentials, or SSH keys).
2. **Context Degradation & Token Budget Depletion**: LLMs have finite context windows. Reading full multi-thousand-line files exhausts token budgets immediately and increases hallucination rates during code refactoring.

### How this project solves these problems:
- **Strictly Sandboxed Workspace**: All file operations resolve strictly inside the `./workspace` directory. Any attempt to escape the root boundary via relative path traversal (`../`, `..\`), poison null bytes (`\0`), or absolute drive paths is intercepted and rejected with a `SecurityError`.
- **Token-Aware Line Chunking**: The `read_file` tool supports 1-indexed pagination (`startLine`, `maxLines` capped at 500) to keep LLM context consumption minimal and purposeful.
- **Persistent Disk-Based Shared Memory**: Cross-session context is preserved using physical Markdown artifacts (`PROJECT_STATE`, `PLAN_LOG`, `CHECKPOINTS`, `DECISIONS`), allowing an **Architect Agent** and a **Builder Agent** to collaborate asynchronously across isolated operational sessions.

---

## System Architecture

```
┌────────────────────────────────────────────────────────┐
│             CLAUDE (Web Browser / Desktop)             │
│            Client: Autonomous LLM Sessions             │
└──────────────────────────┬─────────────────────────────┘
                           │ (Streamable HTTP / SSE)
                           ▼
┌────────────────────────────────────────────────────────┐
│             CLOUDFLARE SECURE HTTPS TUNNEL             │
│    https://<subdomain>.trycloudflare.com/mcp           │
└──────────────────────────┬─────────────────────────────┘
                           │ (Local Proxy to Port 3000)
                           ▼
┌────────────────────────────────────────────────────────┐
│             CAOILE MCP SERVER (Node.js/Express)        │
│  ├── Multi-Session Map Router (Isolated Sessions)      │
│  ├── Zod Schema Validator & Error Formatter            │
│  └── Sandbox Security Engine (Canonical Path Resolver) │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│            SANDBOXED WORKSPACE (./workspace/)          │
│  ├── PROJECT_STATE.md   ◄── Handoff State              │
│  ├── PLAN_LOG.md        ◄── Task Blueprint             │
│  ├── CHECKPOINTS.md     ◄── Commit Audit Trail         │
│  └── src/               ◄── Sandboxed Code Base        │
└────────────────────────────────────────────────────────┘
```

---

## Tool Catalog (9 Custom MCP Tools)

Every tool is implemented with strict **Zod validation schemas** and returns formatted JSON-RPC error responses (`isError: true`) on failure without crashing the server:

| Tool | Parameters | Purpose & Operational Details |
| :--- | :--- | :--- |
| **`list_files`** | `path` (string, opt)<br>`recursive` (boolean) | Lists directories and files within the sandbox. Recursive traversal is limited to a depth of 5 to protect against deep recursion loops. |
| **`read_file`** | `path` (string)<br>`startLine` (int, opt)<br>`maxLines` (int, opt) | Reads text files with line pagination (default: 200 lines, maximum: 500 lines) to prevent token window overflow and reduce API costs. |
| **`write_file`** | `path` (string)<br>`content` (string) | Creates or completely overwrites a file in the workspace. Missing parent directories are created automatically. |
| **`str_replace`** | `path` (string)<br>`old_str` (string)<br>`new_str` (string) | Performs surgical string replacement. Enforces substring uniqueness before mutation to prevent unintended edits. |
| **`delete_file`** | `path` (string)<br>`confirm` (boolean) | Destructively removes a target file or folder. Requires an explicit `confirm: true` parameter as a protective safety gate. |
| **`search_files`** | `query` (string)<br>`path` (string, opt)<br>`maxMatches` (int) | Rapid pattern matching across workspace files. Automatically excludes `.git` and `node_modules`. |
| **`git_status`** | *(none)* | Inspects the git working tree (untracked, modified, staged files) in the sandboxed repository. |
| **`git_commit`** | `message` (string) | Stages all workspace changes and creates a checkpoint commit with a descriptive message. |
| **`git_diff`** | *(none)* | Inspects unstaged modifications before recording a commit checkpoint. |

---

## Project Structure

```text
Caoile_mcp-file-server/
├── .env.example                      # Configuration template for environment variables
├── .gitignore                        # Git exclusion rules (node_modules, dist, .env)
├── ecosystem.config.cjs              # PM2 process manager configuration (auto-restart)
├── package.json                      # Project dependencies and script definitions
├── tsconfig.json                     # TypeScript compiler configuration (ES2022 / NodeNext)
├── vitest.config.ts                  # Vitest unit test configuration
│
├── src/                              # Source code directory
│   ├── index.ts                      # Server entrypoint (Streamable HTTP + Stdio router)
│   ├── tools.ts                      # 9 MCP tool definitions and Zod schemas
│   ├── security/
│   │   ├── auth.ts                   # Bearer token authentication middleware
│   │   ├── sandbox.ts                # Canonical path resolver and traversal prevention
│   │   └── sandbox.test.ts           # Vitest unit test suite for sandbox security
│   ├── services/
│   │   ├── fileOps.ts                # Core implementation for file ops and git engine
│   │   └── fileOps.test.ts           # Vitest unit test suite for file services
│   └── simulation/
│       └── runDemo.ts                # Automated end-to-end multi-agent test runner
│
├── workspace/                        # SANDBOX ROOT (All agent modifications are isolated here)
│   ├── PROJECT_STATE.md              # High-level task status and session handoff directives
│   ├── PLAN_LOG.md                   # Objective checklist and architectural blueprint
│   ├── CHECKPOINTS.md                # Git commit hash audit log (CP-000, CP-001, CP-002)
│   └── DECISIONS.md                  # Architecture Decision Records (ADRs)
│
├── README.md                         # This documentation file
├── TECHNICAL_REPORT.md               # Architecture choices, design rationale, and threat model
└── DEMO_TRANSCRIPT.md                # Multi-agent execution transcript evidence
```

---

## Multi-Agent Handoff Protocol

Cross-session persistence is managed through **4 Structured Markdown Artifacts**:

```
[Planner]
  1. list_files() ──────────► Inspects workspace structure.
  2. read_file()  ──────────► Reads PLAN_LOG.md and PROJECT_STATE.md.
  3. write_file() ──────────► Formulates and saves architectural blueprint in PLAN_LOG.md.
  4. write_file() ──────────► Updates PROJECT_STATE.md (status: PLANNING_COMPLETED).

               ▼ [Session Handoff via Local Disk State] ▼

[Developer]
  1. read_file()  ──────────► Reads PROJECT_STATE.md to verify handoff status.
  2. read_file()  ──────────► Reads PLAN_LOG.md to retrieve target specifications.
  3. write_file() ──────────► Implements source files inside workspace/src/.
  4. git_commit() ──────────► Commits changes to the workspace git repository.
  5. write_file() ──────────► Logs checkpoint ID (e.g., CP-001) in CHECKPOINTS.md.
```

---

## Fresh Device Setup & Migration Guide

Follow these steps to set up and run this project on a new laptop or workstation:

### 1. Prerequisites
Install the following utilities on the target machine:
- **Node.js (LTS v20+ or v24+)**: [nodejs.org](https://nodejs.org)
- **Git for Windows**: [git-scm.com](https://git-scm.com)
- **Cloudflare Tunnel CLI (`cloudflared`)**:
  Install via PowerShell / CMD:
  ```powershell
  winget install --id Cloudflare.cloudflared -e
  ```

> 💡 **PowerShell Execution Policy**:  
> If npm scripts are blocked by default PowerShell policies (`running scripts is disabled on this system`), run:  
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force`

---

### 2. Clone Repository & Install Dependencies
Open a terminal on the new machine:

```bash
# 1. Navigate to your target directory
cd Documents

# 2. Clone the repository
git clone https://github.com/klawi1121/Caoile_mcp-file-server.git
cd Caoile_mcp-file-server

# 3. Install project dependencies
npm install
```

---

### 3. Configure Environment Variables
Create a local `.env` file from the example template:
```bash
copy .env.example .env
```
Ensure the `.env` contents match the following configuration:
```env
PORT=3000
HOST=0.0.0.0
WORKSPACE_ROOT=./workspace
AUTH_TOKEN=
```
*(Leave `AUTH_TOKEN` blank for open local pairing with Claude Web Connectors).*

---

### 4. Run Test Suite & Build Artifacts
Verify system defenses and compile TypeScript:
```bash
# Run the 11 unit test assertions
npm test

# Compile TypeScript to dist/ directory
npm run build
```

---

### 5. Start Server and Tunnel (Two Terminal Windows)

Keep both terminal windows running concurrently:

#### Terminal 1: Launch MCP Server
```bash
npm start
```
*Expected output: `🚀 Caoile MCP File Server running at http://0.0.0.0:3000`*

#### Terminal 2: Expose via Cloudflare Tunnel
```bash
cloudflared tunnel --url http://localhost:3000
```
*Locate and copy the generated public HTTPS URL, for example:*  
👉 `https://stages-stadium-designation-emissions.trycloudflare.com`

---

### 6. Connect to Claude (claude.ai in Browser)

1. Open **[claude.ai](https://claude.ai)** ➔ Click on your Profile avatar (bottom-left) ➔ **Settings** ➔ **Connectors**.
2. Click **Add custom connector**:
   - **Name**: `Caoile File Server`
   - **URL**: `https://<your-cloudflare-subdomain>.trycloudflare.com/mcp` *(must end with `/mcp`)*
   - **Authentication**: `No sign-in`
3. Click **Add / Connect**.
4. The system will confirm **Connected to Caoile File Server** with all 9 tools available.

---

## Testing & Verification

### Automated Unit Test Suite:
```bash
npm test
```
- `src/security/sandbox.test.ts`: 6/6 tests passing (Path traversal, null byte injections, Windows drive escapes).
- `src/services/fileOps.test.ts`: 5/5 tests passing (Chunked reads, surgical edits, delete confirmation gates, search).

### Automated Multi-Agent Simulation:
While the server is active on port 3000, run the simulation runner in a separate terminal:
```bash
npx tsx src/simulation/runDemo.ts
```
This generates `DEMO_TRANSCRIPT.md` and `DEMO_TRANSCRIPT.json` as verifiable empirical evidence of cross-session multi-agent handoff execution.