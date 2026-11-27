import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.env.DIST_DIR ?? "/home/ubuntu/services/ascii_gierka/current/dist");
const host = process.env.HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "4175", 10);

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
  [".wasm", "application/wasm"]
]);

function exists(file) {
  try { return statSync(file).isFile(); } catch { return false; }
}

const server = createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end("Method not allowed\n");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  } catch {
    res.writeHead(400);
    res.end("Bad request\n");
    return;
  }

  const candidate = resolve(root, "." + pathname);
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    res.writeHead(400);
    res.end("Bad path\n");
    return;
  }

  let file = candidate;
  if (!exists(file)) {
    if (extname(pathname)) {
      res.writeHead(404, { "Cache-Control": "no-store" });
      res.end("Not found\n");
      return;
    }
    file = resolve(root, "index.html");
  }

  if (!exists(file)) {
    res.writeHead(503, { "Cache-Control": "no-store" });
    res.end("Build is not ready\n");
    return;
  }

  const isIndex = file === resolve(root, "index.html");
  const headers = {
    "Content-Type": types.get(extname(file).toLowerCase()) ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": isIndex ? "no-cache, no-store, must-revalidate" : "public, max-age=300"
  };
  try { headers["Content-Length"] = String(statSync(file).size); } catch {
    res.writeHead(404);
    res.end();
    return;
  }

  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = createReadStream(file);
  stream.on("error", () => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
  stream.pipe(res);
});

server.listen(port, host, () => {
  console.log(`DOMINIUM static server on http://${host}:${port}; root=${root}`);
});
