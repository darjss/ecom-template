import { spawn } from "node:child_process";

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${code ?? "no status"}`));
      }
    });
  });

await run("pnpm", ["exec", "oxlint", "."]);
await run("pnpm", ["--filter", "@shops/urnuun-48", "exec", "eslint", "src/**/*.astro"]);
