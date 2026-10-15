# CSE2 Documentation

**Project Title:** Midterms PT 1: Build Your Own MCP File-Server Connector  
**Prepared by:** Quennie L. Caoie
**Course and Year:** BSCS - 3B
**Submitted to:** Mr. Rasheed
**Repository:** `https://github.com/klawi1121/Caoile_mcp-file-server`  

---

## Project Overview

This project is my MCP File-Server Connector. MCP connector lets an AI agent work with files in a controlled workspace. The agent can only access the workspace/ folder, not the entire computer. This helps protect my personal files and system folders from accidental changes.

This server has nine tools: listing, reading, writing, searching, replacing, deleting, checking Git status, reviewing a Git diff, and creating a Git commit. It supports Streamable HTTP for remote clients and Stdio for local clients. The Markdown files in the workspace also help one agent continue work started by another agent.


---

## Main Parts of the System

| Part | Technology | Purpose |
| :--- | :--- | :--- |
| Server | Node.js and TypeScript | Runs the server and catches common code errors before execution. |
| MCP support | `@modelcontextprotocol/sdk` | The package that lets my server share its tools with MCP apps. |
| Connections | Streamable HTTP and Stdio | Supports remote clients through a tunnel and local desktop tools. |
| Input checking | Zod | Checks the information sent to a tool/AI before it touches any file. |
| File protection | `Sandbox` class | A safety check that keeps every file path inside workspace/. |
| Process manager | PM2 | Optional tool that restarts the server after a crash. |
| Public link | Cloudflare Tunnel | Gives my local server an HTTPS web address without changing any router settings. |

---

## Problems I Encountered and How I Fixed Them

### 1. Dependency warnings after installation
- **What happened:** After installing, npm audit showed warnings about old versions of Vitest, the tool I use for testing.
- **Solution:** I updated Vitest and ran the audit again to make sure the warnings were gone.

```powershell
npm install -D vitest@latest
```

### 2. TypeScript error while registering MCP tools
- **What happened:** The build showed TS2345 because ToolResult did not match what the old way of adding tools expected.
- **Solution:**  I switched to McpServer, the simpler way provided by the SDK, and fixed the result so it follows the format that MCP needs.


### 3. A second app could not start a session
- **What happened:** A new app received the message “Server already initialized”.
- **Cause:** Both apps were using one shared connection.
- **Solution:** TThe server now keeps a list of connections, so every new app gets its own connection and its own copy of the server.


### 4. PowerShell blocked npm commands
- **What happened:** `npm install` could not run because PowerShell blocked `npm.ps1`.
- **Solution:** I changed the PowerShell permission for my own user account only, not for the whole computer.

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

### 5. Node.js import types were not recognized
- **What happened:** TypeScript and VS Code showed errors for imports such as `node:path`.
- **Solution:** TypeScript did not know the built-in Node.js features yet. I installed the Node.js type package and checked that my TypeScript settings supported NodeNext.


### 6. Tests were reading old files
- **What happened:** A `str_replace` test failed  even after I had already fixed the TypeScript code.
- **Cause:** Old compiled test output was also being read.
- **Solution:** I removed the old files from the test run and ran the test again using the current source files.


### 7. Cloudflare Tunnel showed a certificate date error
- **What happened:** Cloudflare Tunnel could not verify that its connection was safe.
- **Cause:** My computer's clock did not match the internet time.
- **Solution:** I synced the clock in **Settings > Time & language > Date & time > Sync now**.


### 8. The web connector returned 404 or 401
- **What happened:** A custom connector could not reach the server or the server did not accept it.
- **Cause:** The tunnel URL was missing `/mcp` at the end,  or the app could not send the secret key that the server asks for.
- **Solution:** I used the complete link, for example https://oakland-airplane-written-zum.trycloudflare.com/mcp. Since the link is public, the server should keep its protection and turned on. 


### 9. An agent tried to write outside the workspace
- **What happened:** The agent used a file path outside workspace/, and the server rejected it.
- **Solution:** The agent used paths inside the workspace instead, such as demo.txt or src/users.ts . This is the behavior I wanted, because it shows the protections works.

---

## Command Reference

### Set up and test

```powershell
# Run this only if PowerShell blocks npm scripts
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force

git clone https://github.com/klawi1121/Caoile_mcp-file-server.git
cd Caoile_mcp-file-server
npm install
npm test
npm run build
```

### Start the server and tunnel

Use separate terminal windows for the server and the tunnel.

```powershell
# Terminal 1
npm start

# Terminal 2
cloudflared tunnel --url http://localhost:3000
```

### Optional PM2 commands

```powershell
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 status
```

### Git commands

```powershell
git status
git diff
git add -A
git commit -m "feat: describe the completed change"
git push origin <branch-name>
```

---

## Verification and Evidence

The project has automated tests for the sandbox and file-operation services. The current suite has 11 passing tests for safe paths, reading and writing files, string replacement, delete confirmation, and search behavior.

The multi-agent demo uses a simple handoff process:

1. An Architect agent reads the planning files and prepares the next task.
2. A Builder agent opens those files in a new session, creates the requested workspace files, and records a Git checkpoint.
3. The files `PROJECT_STATE.md`, `PLAN_LOG.md`, `CHECKPOINTS.md`, and `DECISIONS.md` keep the task context for the next session.

The files `DEMO_TRANSCRIPT.md` and `DEMO_TRANSCRIPT.json` contain the recorded tool calls from the demonstration. All agent file operations stay inside `workspace/`.
