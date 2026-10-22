#!/usr/bin/env node
import { createServer } from "node:http";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { PROJECT_PATH, validateProject, buildProject } from "./motion-graphics.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EDITOR_DIR = join(ROOT, "tools", "motion-editor");
const HOST = "127.0.0.1";
const PORT = Number(process.env.MOTION_EDITOR_PORT || 4177);
const MAX_BODY_BYTES = 1024 * 1024;
const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/editor.css", ["editor.css", "text/css; charset=utf-8"]],
  ["/editor.js", ["editor.js", "text/javascript; charset=utf-8"]]
]);

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  });
  response.end(JSON.stringify(body));
}
function localHost(request) {
  const host = String(request.headers.host || "").toLowerCase();
  return host === HOST + ":" + PORT || host === "localhost:" + PORT;
}
function localOrigin(request) {
  if (!request.headers.origin) return true;
  try {
    const url = new URL(request.headers.origin);
    return url.protocol === "http:" &&
      (url.hostname === HOST || url.hostname === "localhost") &&
      Number(url.port) === PORT;
  } catch {
    return false;
  }
}
async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk.toString("utf8");
    if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
      throw Object.assign(new Error("Request body exceeds 1 MB."), { statusCode: 413 });
    }
  }
  return body;
}
function readCurrentProject() {
  return JSON.parse(readFileSync(PROJECT_PATH, "utf8"));
}

const server = createServer(async function (request, response) {
  if (!localHost(request)) return json(response, 403, { error: "Use the local editor address only." });
  if (!localOrigin(request)) return json(response, 403, { error: "Cross-origin requests are not allowed." });
  const url = new URL(request.url || "/", "http://" + HOST + ":" + PORT);

  if (request.method === "GET" && url.pathname === "/api/health") {
    return json(response, 200, { ok: true, project: basename(PROJECT_PATH) });
  }
  if (request.method === "GET" && url.pathname === "/api/project") {
    try { return json(response, 200, readCurrentProject()); }
    catch (error) { return json(response, 500, { error: "Cannot read project: " + error.message }); }
  }
  if (request.method === "PUT" && url.pathname === "/api/project") {
    let project;
    try { project = JSON.parse(await readBody(request)); }
    catch (error) {
      return json(response, error.statusCode || 400, {
        error: error.statusCode === 413 ? error.message : "Request body must be valid JSON."
      });
    }
    const errors = validateProject(project);
    if (errors.length) return json(response, 422, { error: "Project validation failed.", details: errors });
    try {
      const tempPath = PROJECT_PATH + ".tmp";
      writeFileSync(tempPath, JSON.stringify(project, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
      renameSync(tempPath, PROJECT_PATH);
      return json(response, 200, { ok: true, saved: true });
    } catch (error) {
      return json(response, 500, { error: "Cannot save project: " + error.message });
    }
  }
  if (request.method === "POST" && url.pathname === "/api/build") {
    try {
      const built = buildProject(readCurrentProject());
      return json(response, 200, {
        ok: true,
        outputDir: built.outputDir,
        sceneCount: built.sceneCount,
        duration: built.duration,
        next: "Run HyperFrames lint and preview from the generated project directory."
      });
    } catch (error) {
      return json(response, 400, { error: error.message });
    }
  }
  if (request.method === "GET" && STATIC_FILES.has(url.pathname)) {
    const entry = STATIC_FILES.get(url.pathname);
    try {
      const body = readFileSync(join(EDITOR_DIR, entry[0]));
      response.writeHead(200, {
        "Content-Type": entry[1],
        "Content-Length": body.length,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
      });
      return response.end(body);
    } catch (error) {
      return json(response, 500, { error: "Could not read editor assets: " + error.message });
    }
  }
  return json(response, 404, { error: "Not found." });
});

if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) {
  console.error("MOTION_EDITOR_PORT must be an integer from 1024 to 65535.");
  process.exit(1);
}
server.listen(PORT, HOST, function () {
  console.log("ShadowEditor Motion Editor: http://" + HOST + ":" + PORT);
  console.log("Shared project: " + PROJECT_PATH);
  console.log("Bound to loopback only. Press Ctrl+C to stop.");
});
