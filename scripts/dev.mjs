/**
 * Dev server launcher — spawns tsx (server) and vite (client) as direct Node
 * child processes, bypassing cmd.exe batch wrappers that cause the Windows
 * "Terminate batch job?" double-prompt on Ctrl+C.
 */

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const node = process.execPath;

const BLUE = "\x1b[34m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

function spawnLabeled(label, color, args, opts = {}) {
  const env = { ...process.env, FORCE_COLOR: "1" };
  const child = spawn(node, args, { ...opts, env, stdio: ["ignore", "pipe", "pipe"] });

  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (data) => {
      for (const line of data.toString().split("\n")) {
        if (line) process.stdout.write(`${color}[${label}]${RESET} ${line}\n`);
      }
    });
  }

  return child;
}

const procs = [
  spawnLabeled("server", BLUE, [
    resolve(root, "node_modules/tsx/dist/cli.mjs"),
    "watch",
    resolve(root, "packages/server/src/index.ts"),
  ]),
  spawnLabeled("client", GREEN, [
    resolve(root, "node_modules/vite/bin/vite.js"),
  ], { cwd: resolve(root, "packages/client") }),
];

function shutdown() {
  for (const p of procs) {
    if (!p.killed) p.kill();
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

for (const p of procs) {
  p.on("exit", () => {
    shutdown();
    process.exit();
  });
}
