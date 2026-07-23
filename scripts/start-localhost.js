#!/usr/bin/env node

const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const reverseResult = spawnSync("adb", ["reverse", "tcp:8081", "tcp:8081"], {
  stdio: "ignore",
  shell: process.platform === "win32",
});

if (reverseResult.status === 0) {
  console.log("Android emulator port forwarding ready on 8081.");
}

// Spawn Expo via Node so Windows does not need a .cmd shell shim
// (npx.cmd + shell:false throws spawn EINVAL on Node 20+).
const expoCli = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo",
  "bin",
  "cli",
);

const expo = spawn(process.execPath, [expoCli, "start", "--localhost"], {
  stdio: "inherit",
  shell: false,
});

expo.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
