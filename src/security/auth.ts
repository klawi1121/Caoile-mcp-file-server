import { Request, Response, NextFunction } from "express";
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const configuredToken = process.env.AUTH_TOKEN;

  if (!configuredToken) {
    next();
    return;
  }
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers["x-api-key"];
  const queryToken = req.query.token as string | undefined;
  let providedToken: string | undefined;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    providedToken = authHeader.substring(7).trim();
  } else if (typeof apiKeyHeader === "string") {
    providedToken = apiKeyHeader.trim();
  } else if (queryToken) {
    providedToken = queryToken.trim();
  }
  if (!providedToken || providedToken !== configuredToken) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid authorization token for this MCP file-server endpoint",
    });
    return;
  }
  next();
}