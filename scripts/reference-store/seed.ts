import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const persistIndex = args.indexOf("--persist-to");
const persistPath = persistIndex >= 0 ? args.at(persistIndex + 1) : undefined;

const commandArgs = [
  "d1",
  "execute",
  "urnuun-48-db",
  "--config",
  "apps/urnuun-48/wrangler.jsonc",
  "--file",
  "scripts/reference-store/fixture.sql",
  remote ? "--remote" : "--local",
  ...(persistPath ? ["--persist-to", persistPath] : []),
];

const child = spawn("wrangler", commandArgs, { stdio: "inherit" });
child.once("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
