import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityError";
  }
}

export class Sandbox {
  readonly rootPath: string;
  constructor(customRoot?: string) {
    const target = customRoot || process.env.WORKSPACE_ROOT || "./workspace";
    this.rootPath = path.resolve(process.cwd(), target);
    if (!fsSync.existsSync(this.rootPath)) {
      fsSync.mkdirSync(this.rootPath, { recursive: true });
    }
  }
 
  resolvePath(userInputPath: string): string {
    if (!userInputPath || typeof userInputPath !== "string") {
      throw new SecurityError("Invalid path: path cannot be empty");
    }

    if (userInputPath.indexOf("\0") !== -1) {
      throw new SecurityError("Security violation: Null byte detected in path");
    }

    const sanitized = userInputPath.replace(/^[/\\]+/, "");
    const resolved = path.resolve(this.rootPath, sanitized);

    const normalizedRoot = path.normalize(this.rootPath).toLowerCase();
    const normalizedTarget = path.normalize(resolved).toLowerCase();
    const isInside =
      normalizedTarget === normalizedRoot ||
      normalizedTarget.startsWith(normalizedRoot + path.sep);
    if (!isInside) {
      throw new SecurityError(
        `Path traversal blocked: Access outside workspace root is denied (${userInputPath})`
      );
    }
    return resolved;
  }
  
  toRelativePath(absolutePath: string): string {
    return path.relative(this.rootPath, absolutePath).replace(/\\/g, "/");
  }

  async exists(userInputPath: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(userInputPath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}