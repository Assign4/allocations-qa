#!/usr/bin/env node
const { execFileSync } = require("child_process");
const { join } = require("path");

const args = process.argv.slice(2).flatMap((arg) => {
  if (arg.startsWith("--grep=")) return ["--name", arg.slice("--grep=".length)];
  if (arg === "--grep") return ["--name"];
  return [arg];
});

const bin = join(__dirname, "../node_modules/.bin/cucumber-js");

try {
  execFileSync(bin, ["--config", "cucumber.api.config.json", ...args], {
    stdio: "inherit",
  });
} catch (e) {
  process.exit(e.status ?? 1);
}