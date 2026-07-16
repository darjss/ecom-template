import { spawn } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { parse } from "yaml";
import * as v from "valibot";
import {
  DeliveryJournalSchema,
  DeliveryManifestSchema,
  StoreSlugSchema,
  type DeliveryManifest,
} from "./index";

const write = (value: string) => process.stdout.write(`${value}\n`);
const fail = (value: string) => {
  process.stderr.write(`${value}\n`);
  process.exitCode = 1;
};

const help = `store-delivery

Commands:
  validate --manifest <path>
  dev --store <slug>
  build --store <slug>
  create --slug <slug> --name <name>
  apply --manifest <path> --target <name>
  proof --manifest <path> --target <name>
  cleanup --manifest <path> --target <name>`;

const args = process.argv.slice(2).filter((argument) => argument !== "--");
const command = args.at(0);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args.at(index + 1) : undefined;
};
const requireOption = (name: string) => {
  const value = option(name);
  if (!value) {
    throw new Error(`Missing ${name} <value>`);
  }
  return value;
};

const run = (executable: string, commandArgs: readonly string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(executable, commandArgs, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${executable} exited with ${code ?? "no status"}`));
      }
    });
  });

const readManifest = async (): Promise<DeliveryManifest> => {
  const source = await readFile(requireOption("--manifest"), "utf8");
  const parsed: unknown = parse(source);
  return v.parse(DeliveryManifestSchema, parsed);
};

const readTarget = async () => {
  const manifest = await readManifest();
  const targetName = requireOption("--target");
  const target = manifest.targets[targetName];
  if (!target) {
    throw new Error(`Unknown target: ${targetName}`);
  }
  return { targetName, target };
};

const copyStore = async () => {
  const slug = v.parse(StoreSlugSchema, requireOption("--slug"));
  const name = requireOption("--name");
  const source = "apps/urnuun-48";
  const destination = join("apps", slug);
  const destinationExists = await stat(destination).then(
    () => true,
    () => false,
  );
  if (destinationExists) {
    throw new Error(`Store already exists: ${destination}`);
  }
  await cp(source, destination, {
    recursive: true,
    filter: (path) =>
      !["node_modules", "dist", ".astro", ".wrangler", "worker-configuration.d.ts"].includes(
        basename(path),
      ),
  });
  const files = await readdir(destination, { recursive: true, withFileTypes: true });
  for (const file of files) {
    if (!file.isFile() || !/\.(?:astro|json|jsonc|mjs|ts|tsx|yml)$/.test(file.name)) {
      continue;
    }
    const path = join(file.parentPath, file.name);
    const content = await readFile(path, "utf8");
    await writeFile(
      path,
      content
        .replaceAll("urnuun-48", slug)
        .replaceAll("Өрнүүн 48", name)
        .replaceAll("urnuun-48.shop.localhost", `${slug}.shop.localhost`),
    );
  }
  write(`Created ${relative(process.cwd(), destination)}`);
};

const applyTarget = async () => {
  const { targetName, target } = await readTarget();
  if (target.kind !== "local") {
    throw new Error(`Remote apply is intentionally unavailable for ${target.kind}`);
  }
  await run("pnpm", ["--filter", target.app, "db:migrate:local"]);
  await mkdir(".delivery", { recursive: true });
  const journal = v.parse(DeliveryJournalSchema, {
    schemaVersion: 1,
    target: targetName,
    completedSteps: ["local-migrations"],
    updatedAt: new Date().toISOString(),
  });
  await writeFile(
    join(".delivery", `${targetName}.journal.json`),
    JSON.stringify(journal, null, 2),
  );
  write(`Applied local target ${targetName}`);
};

const proofTarget = async () => {
  const { targetName, target } = await readTarget();
  if (target.kind !== "local") {
    throw new Error(`Remote proof requires deployed infrastructure`);
  }
  const slug = target.app.slice("@shops/".length);
  await run("curl", [
    "--fail",
    "--silent",
    "--show-error",
    "--insecure",
    `https://${slug}.shop.localhost:1355/api/health`,
  ]);
  write(`Proved local target ${targetName}`);
};

const cleanupTarget = async () => {
  const { targetName, target } = await readTarget();
  if (target.kind !== "local") {
    throw new Error(`Remote cleanup is intentionally unavailable`);
  }
  const slug = target.app.slice("@shops/".length);
  await rm(join("apps", slug, ".wrangler"), { recursive: true, force: true });
  await rm(join(".delivery", `${targetName}.journal.json`), { force: true });
  write(`Cleaned local target ${targetName}`);
};

try {
  if (!command || command === "--help" || command === "help") {
    write(help);
  } else if (command === "validate") {
    const manifest = await readManifest();
    write(`Valid manifest with ${Object.keys(manifest.targets).length} target(s)`);
  } else if (command === "dev") {
    const slug = v.parse(StoreSlugSchema, requireOption("--store"));
    await run("portless", [`${slug}.shop`, "pnpm", "--filter", `@shops/${slug}`, "dev:direct"]);
  } else if (command === "build") {
    const slug = v.parse(StoreSlugSchema, requireOption("--store"));
    await run("pnpm", ["--filter", `@shops/${slug}`, "build"]);
  } else if (command === "create") {
    await copyStore();
  } else if (command === "apply") {
    await applyTarget();
  } else if (command === "proof") {
    await proofTarget();
  } else if (command === "cleanup") {
    await cleanupTarget();
  } else {
    fail(`Unknown command: ${command}`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : "Delivery command failed");
}
