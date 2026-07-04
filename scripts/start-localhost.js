#!/usr/bin/env node

const { spawn, spawnSync } = require("node:child_process");

const npmCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const reverseResult = spawnSync("adb", ["reverse", "tcp:8081", "tcp:8081"], {
  stdio: "ignore",
});

if (reverseResult.status === 0) {
  console.log("Android emulator port forwarding ready on 8081.");
}

const expo = spawn(npmCommand, ["expo", "start", "--localhost"], {
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
