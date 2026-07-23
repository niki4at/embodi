#!/usr/bin/env node

/**
 * One-command local stack: Android emulator + Convex + Metro (localhost).
 * Usage: npm run dev
 */

const path = require("node:path");
const fs = require("node:fs");
const { spawn, spawnSync } = require("node:child_process");

const AVD_NAME = "Medium_Phone_API_36.1";
const isWin = process.platform === "win32";
const root = path.join(__dirname, "..");

const children = [];

function androidSdkRoot() {
  return (
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk")
  );
}

function resolveTool(name) {
  const sdk = androidSdkRoot();
  const candidates = isWin
    ? [
        path.join(sdk, "platform-tools", `${name}.exe`),
        path.join(sdk, "emulator", `${name}.exe`),
      ]
    : [
        path.join(sdk, "platform-tools", name),
        path.join(sdk, "emulator", name),
      ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return name;
}

function spawnNodeBin(binRelative, args, label) {
  const binPath = path.join(root, "node_modules", ...binRelative);
  if (!fs.existsSync(binPath)) {
    console.error(`Missing ${label} binary at ${binPath}`);
    process.exit(1);
  }

  const child = spawn(process.execPath, [binPath, ...args], {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  children.push(child);
  child.on("exit", (code, signal) => {
    if (signal) {
      shutdown(signal);
      return;
    }
    if (code && code !== 0) {
      console.error(`${label} exited with code ${code}`);
      shutdown(null, code);
    }
  });

  return child;
}

function adbDevices() {
  const adb = resolveTool("adb");
  const result = spawnSync(adb, ["devices"], {
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) return [];
  return (result.stdout || "")
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("*"));
}

function ensureEmulator() {
  const devices = adbDevices();
  const emulatorOnline = devices.some((line) =>
    line.startsWith("emulator-") && line.includes("device"),
  );

  if (emulatorOnline) {
    console.log("Android emulator already running.");
    return;
  }

  const emulator = resolveTool("emulator");
  if (!fs.existsSync(emulator) && emulator === "emulator") {
    console.warn(
      "Android emulator not found. Install Android Studio / SDK, or add emulator to PATH.",
    );
    return;
  }

  console.log(`Starting Android emulator (${AVD_NAME})...`);
  const child = spawn(emulator, ["-avd", AVD_NAME], {
    cwd: root,
    stdio: "ignore",
    shell: false,
    detached: true,
    env: process.env,
  });
  child.unref();
}

function adbReverse() {
  const adb = resolveTool("adb");
  const result = spawnSync(adb, ["reverse", "tcp:8081", "tcp:8081"], {
    stdio: "ignore",
    shell: false,
  });
  if (result.status === 0) {
    console.log("Android emulator port forwarding ready on 8081.");
  }
}

function freePort(port) {
  if (isWin) {
    const listed = spawnSync(
      "cmd",
      ["/c", `netstat -ano | findstr :${port}`],
      { encoding: "utf8", shell: false },
    );
    const pids = new Set();
    for (const line of (listed.stdout || "").split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
    }
    for (const pid of pids) {
      spawnSync("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" });
      console.log(`Freed port ${port} (killed PID ${pid}).`);
    }
    return;
  }

  const listed = spawnSync("lsof", ["-ti", `tcp:${port}`], {
    encoding: "utf8",
  });
  for (const pid of (listed.stdout || "").trim().split(/\s+/).filter(Boolean)) {
    spawnSync("kill", ["-9", pid], { stdio: "ignore" });
    console.log(`Freed port ${port} (killed PID ${pid}).`);
  }
}

function spawnNodeBinSync(binRelative, args, options = {}) {
  const binPath = path.join(root, "node_modules", ...binRelative);
  if (!fs.existsSync(binPath)) {
    console.error(`Missing binary at ${binPath}`);
    process.exit(1);
  }

  return spawnSync(process.execPath, [binPath, ...args], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    env: process.env,
    ...options,
  });
}

function ensureConvexAiFiles() {
  const status = spawnNodeBinSync(["convex", "bin", "main.js"], [
    "ai-files",
    "status",
  ]);
  const output = `${status.stdout || ""}${status.stderr || ""}`;
  if (!/out of date/i.test(output)) {
    return;
  }

  console.log("Convex AI files out of date; updating...");
  const updated = spawnNodeBinSync(
    ["convex", "bin", "main.js"],
    ["ai-files", "update"],
    { stdio: "inherit" },
  );
  if (updated.status !== 0) {
    console.warn("Convex AI files update failed; continuing anyway.");
  }
}

function shutdown(signal, code = 0) {
  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill(signal || "SIGTERM");
      } catch {
        // ignore
      }
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

ensureConvexAiFiles();
ensureEmulator();
freePort(8081);
adbReverse();

console.log("Starting Convex...");
spawnNodeBin(["convex", "bin", "main.js"], ["dev"], "Convex");

console.log("Starting Metro (localhost)...");
spawnNodeBin(
  ["expo", "bin", "cli"],
  ["start", "--localhost", "--port", "8081"],
  "Metro",
);

console.log(
  "\nStack starting. When the emulator is up, open the Embodi app (or press a in Metro).\n",
);
