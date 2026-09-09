import { spawn } from "node:child_process";

const children = [
  spawn(process.execPath, ["scripts/registry-bridge.mjs"], { stdio: "inherit", env: process.env }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js"], { stdio: "inherit", env: process.env }),
];

const stop = () => children.forEach((child) => child.kill());
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
children.forEach((child) => child.once("exit", (code) => {
  if (code && code !== 0) process.exitCode = code;
}));
