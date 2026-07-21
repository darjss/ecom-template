import { spawn } from "node:child_process";
import * as v from "valibot";

const StoreSlugSchema = v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));
const StoreNameSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80));
const StoreOriginSchema = v.pipe(v.string(), v.url());

const write = (value: string) => process.stdout.write(`${value}\n`);
const fail = (value: string) => {
  process.stderr.write(`${value}\n`);
  process.exitCode = 1;
};

const help = `store-delivery

Commands:
  create --slug <slug> --name <name>
  seed [--local | --remote] [--persist-to <path>]
  deploy --store <slug>
  proof --url <origin>`;

const args = process.argv.slice(2).filter((argument) => argument !== "--");
const command = args.at(0);
const commandArgs = args.slice(1);
const option = (name: string) => {
  const index = commandArgs.indexOf(name);
  return index >= 0 ? commandArgs.at(index + 1) : undefined;
};
const requireOption = (name: string) => {
  const value = option(name);
  if (!value) {
    throw new Error(`Missing ${name} <value>`);
  }
  return value;
};

const run = (executable: string, commandArguments: readonly string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(executable, commandArguments, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${executable} exited with ${code ?? "no status"}`));
      }
    });
  });

const createStore = () => {
  v.parse(StoreSlugSchema, requireOption("--slug"));
  v.parse(StoreNameSchema, requireOption("--name"));
  throw new Error("Store creation is unavailable while this repository owns one Store");
};

const seedStore = () =>
  run("pnpm", ["exec", "tsx", "scripts/reference-store/seed.ts", ...commandArgs]);

const deployStore = () => {
  const slug = v.parse(StoreSlugSchema, requireOption("--store"));
  return run("pnpm", ["exec", "wrangler", "deploy", "--config", `apps/${slug}/wrangler.jsonc`]);
};

const proveStore = async () => {
  const origin = v.parse(StoreOriginSchema, requireOption("--url"));
  const healthUrl = new URL("/api/health", origin).toString();
  await run("curl", ["--fail", "--silent", "--show-error", healthUrl]);
  write(`Proved ${healthUrl}`);
};

try {
  if (!command || command === "--help" || command === "help") {
    write(help);
  } else if (command === "create") {
    createStore();
  } else if (command === "seed") {
    await seedStore();
  } else if (command === "deploy") {
    await deployStore();
  } else if (command === "proof") {
    await proveStore();
  } else {
    fail(`Unknown command: ${command}`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : "Delivery command failed");
}
