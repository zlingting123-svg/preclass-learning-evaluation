import express, { type Express } from "express";
import { existsSync, realpathSync } from "node:fs";
import { resolve, extname } from "node:path";
import { ensure } from "./errors.js";
export function staticSite(app: Express, directory: string) {
  const root = realpathSync(directory),
    index = resolve(root, "index.html");
  ensure(existsSync(index), 503, "STATIC_UNCONFIGURED", "缺少前端生产构建");
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    if (req.path.split("/").some((p) => p.startsWith("."))) {
      res.sendStatus(404);
      return;
    }
    next();
  });
  app.use(
    express.static(root, {
      dotfiles: "deny",
      index: false,
      redirect: false,
      fallthrough: true,
      setHeaders(res, path) {
        res.setHeader(
          "Cache-Control",
          path.includes("/assets/") || path.includes("\\assets\\")
            ? "public, max-age=31536000, immutable"
            : "no-store",
        );
      },
    }),
  );
  app.get(/.*/, (req, res, next) => {
    if (
      req.path === "/api" ||
      req.path.startsWith("/api/") ||
      extname(req.path) ||
      !req.accepts("html")
    )
      return next();
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(index);
  });
}
