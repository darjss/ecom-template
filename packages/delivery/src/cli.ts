import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";
import * as v from "valibot";
import {
  DeliveryJournalSchema,
  DeliveryManifestSchema,
  DevProcessRecordSchema,
  ProofRecordSchema,
  StoreNameSchema,
  StoreSlugSchema,
  type DeliveryManifest,
} from "./index";
import { parsePortlessOrigin, readCommitIdentity, resolveLocalStore } from "./portless";

const execFileOutput = promisify(execFile);
const write = (value: string) => process.stdout.write(`${value}\n`);
const fail = (value: string) => {
  process.stderr.write(`${value}\n`);
  process.exitCode = 1;
};

const help = `store-delivery

Commands:
  validate --manifest <path>
  origin --store <slug>
  dev --store <slug>
  preview --store <slug>
  build --store <slug>
  owner-add --store <slug> --email <email> (--local | --manifest <path> --target <name>)
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

const run = (
  executable: string,
  commandArgs: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(executable, commandArgs, { env: environment, stdio: "inherit" });
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

const targetSlug = (app: string) => v.parse(StoreSlugSchema, app.slice("@shops/".length));
const journalPath = (targetName: string) => join(".delivery", `${targetName}.journal.json`);
const proofPath = (targetName: string) => join(".delivery", `${targetName}.proof.json`);
const devProcessPath = (slug: string) => join(".delivery", `${slug}.dev.json`);

const SqlEmailSchema = v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email());
const StaffIdSchema = v.pipe(v.string(), v.regex(/^staff_[0-9a-hjkmnp-tv-z]{26}$/));

const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;

const addOwner = async () => {
  const slug = v.parse(StoreSlugSchema, requireOption("--store"));
  const email = v.parse(SqlEmailSchema, requireOption("--email"));
  const { stdout: staffIdSource } = await execFileOutput("pnpm", ["--silent", "staff:id:create"]);
  const staffId = v.parse(StaffIdSchema, staffIdSource.trim());
  const now = Date.now();
  const statement = `INSERT INTO staff_members (id, normalized_email, auth_user_id, status, role, session_generation, created_at, updated_at, approved_at, revoked_at) VALUES (${sqlString(staffId)}, ${sqlString(email)}, NULL, 'active', 'owner', 0, ${now}, ${now}, ${now}, NULL) ON CONFLICT(normalized_email) DO UPDATE SET status = 'active', role = 'owner', session_generation = staff_members.session_generation + 1, approved_at = excluded.approved_at, revoked_at = NULL, updated_at = excluded.updated_at`;
  if (args.includes("--local")) {
    if (option("--manifest") || option("--target")) {
      throw new Error("Owner provisioning accepts either --local or a manifest target, not both");
    }
    const localStore = await resolveLocalStore(slug);
    await run("pnpm", [
      "--filter",
      `@shops/${localStore.slug}`,
      "exec",
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--local",
      "--command",
      statement,
    ]);
    write(`Provisioned active Owner ${email} for local Store ${localStore.slug}`);
    return;
  }

  const { targetName, target } = await readTarget();
  if (target.kind === "local" || targetSlug(target.app) !== slug) {
    throw new Error("Remote Owner target does not match the selected deployed Store");
  }
  let journalSource: string;
  try {
    journalSource = await readFile(journalPath(targetName), "utf8");
  } catch {
    throw new Error("Remote Owner target lacks a deployed delivery journal");
  }
  const journal = v.parse(DeliveryJournalSchema, JSON.parse(journalSource));
  const commit = await readCommitIdentity();
  if (
    journal.target !== targetName ||
    journal.app !== target.app ||
    journal.commit !== commit ||
    !journal.completedSteps.includes("remote-deploy")
  ) {
    throw new Error("Remote Owner target lacks a matching deployed delivery journal");
  }
  await run("pnpm", [
    "--filter",
    target.app,
    "exec",
    "wrangler",
    "d1",
    "execute",
    `${target.resourcePrefix}-db`,
    "--remote",
    "--command",
    statement,
  ]);
  write(`Provisioned active Owner ${email} for deployed target ${targetName}`);
};

const rejectStoreCreation = () => {
  v.parse(StoreSlugSchema, requireOption("--slug"));
  v.parse(StoreNameSchema, requireOption("--name"));
  throw new Error(
    "Store creation is intentionally unavailable until delivery owns a Store-neutral app skeleton",
  );
};

const applyTarget = async () => {
  const { targetName, target } = await readTarget();
  if (target.kind !== "local") {
    throw new Error(`Remote apply is intentionally unavailable for ${target.kind}`);
  }
  const localStore = await resolveLocalStore(targetSlug(target.app));
  const commit = await readCommitIdentity();
  await run("pnpm", ["--filter", target.app, "db:migrate:local"]);
  await mkdir(".delivery", { recursive: true });
  const journal = v.parse(DeliveryJournalSchema, {
    schemaVersion: 1,
    target: targetName,
    app: target.app,
    commit,
    origin: localStore.origin,
    completedSteps: ["local-migrations"],
    updatedAt: new Date().toISOString(),
  });
  await writeFile(journalPath(targetName), JSON.stringify(journal, null, 2));
  write(`Applied local target ${targetName} at ${commit}`);
};

const readRouteProcess = async (origin: string) => {
  const { stdout } = await execFileOutput("portless", ["list"]);
  const routeLine = stdout.split("\n").find((line) => line.includes(origin));
  const pidSource = routeLine?.match(/\(pid (\d+)\)/)?.at(1);
  if (!pidSource) {
    throw new Error(`No running Portless process owns ${origin}`);
  }
  return v.parse(v.pipe(v.string(), v.regex(/^\d+$/)), pidSource);
};

const verifyRouteIdentity = async (
  slug: string,
  app: string,
  origin: string,
  pid: string,
  commit: string,
) => {
  const source = await readFile(devProcessPath(slug), "utf8");
  const processRecord = v.parse(DevProcessRecordSchema, JSON.parse(source));
  if (
    processRecord.app !== app ||
    processRecord.commit !== commit ||
    processRecord.origin !== origin ||
    processRecord.checkoutRoot !== process.cwd() ||
    processRecord.pid !== Number(pid)
  ) {
    throw new Error("Portless route belongs to a different target, checkout, or commit");
  }
  process.kill(processRecord.pid, 0);
};

const proofTarget = async () => {
  const { targetName, target } = await readTarget();
  if (target.kind !== "local") {
    throw new Error("Remote proof requires deployed infrastructure");
  }
  const journalSource = await readFile(journalPath(targetName), "utf8");
  const journal = v.parse(DeliveryJournalSchema, JSON.parse(journalSource));
  const commit = await readCommitIdentity();
  const localStore = await resolveLocalStore(targetSlug(target.app));
  if (
    journal.target !== targetName ||
    journal.app !== target.app ||
    journal.commit !== commit ||
    journal.origin !== localStore.origin
  ) {
    throw new Error("Local apply journal does not match the selected target, checkout, and commit");
  }
  const pid = await readRouteProcess(localStore.origin);
  await verifyRouteIdentity(localStore.slug, target.app, localStore.origin, pid, commit);
  const healthUrl = `${localStore.origin}/api/health`;
  await run("curl", ["--fail", "--silent", "--show-error", healthUrl]);
  const proof = v.parse(ProofRecordSchema, {
    target: targetName,
    app: target.app,
    commit,
    healthUrl,
    provedAt: new Date().toISOString(),
    passed: true,
  });
  await writeFile(proofPath(targetName), JSON.stringify(proof, null, 2));
  write(`Proved local target ${targetName} at ${commit} through ${localStore.origin}`);
};

const cleanupTarget = async () => {
  const { targetName, target } = await readTarget();
  if (target.kind !== "local") {
    throw new Error("Remote cleanup is intentionally unavailable");
  }
  const slug = targetSlug(target.app);
  await rm(join("apps", slug, ".wrangler"), { recursive: true, force: true });
  await rm(journalPath(targetName), { force: true });
  await rm(proofPath(targetName), { force: true });
  await rm(devProcessPath(slug), { force: true });
  write(`Cleaned local target ${targetName}`);
};

const StoreRunModeSchema = v.picklist(["dev", "preview"]);

const serveStore = async () => {
  const slug = v.parse(StoreSlugSchema, requireOption("--store"));
  const mode = v.parse(StoreRunModeSchema, requireOption("--mode"));
  const origin = parsePortlessOrigin(process.env.PORTLESS_URL);
  const commit = await readCommitIdentity();
  await mkdir(".delivery", { recursive: true });
  const processRecord = v.parse(DevProcessRecordSchema, {
    app: `@shops/${slug}`,
    commit,
    origin,
    checkoutRoot: process.cwd(),
    pid: process.ppid,
  });
  await writeFile(devProcessPath(slug), JSON.stringify(processRecord, null, 2));
  await run("pnpm", ["--filter", `@shops/${slug}`, `${mode}:direct`]);
};

const startStore = async (mode: "dev" | "preview") => {
  const localStore = await resolveLocalStore(requireOption("--store"));
  const commit = await readCommitIdentity();
  write(`Starting ${localStore.origin} from ${process.cwd()} at ${commit}`);
  await run("portless", [
    localStore.name,
    "node",
    "--import",
    "tsx",
    "packages/delivery/src/cli.ts",
    "serve",
    "--store",
    localStore.slug,
    "--mode",
    mode,
  ]);
};

try {
  if (!command || command === "--help" || command === "help") {
    write(help);
  } else if (command === "validate") {
    const manifest = await readManifest();
    write(`Valid manifest with ${Object.keys(manifest.targets).length} target(s)`);
  } else if (command === "origin") {
    write((await resolveLocalStore(requireOption("--store"))).origin);
  } else if (command === "dev") {
    await startStore("dev");
  } else if (command === "preview") {
    await startStore("preview");
  } else if (command === "serve") {
    await serveStore();
  } else if (command === "build") {
    const slug = v.parse(StoreSlugSchema, requireOption("--store"));
    await run("pnpm", ["--filter", `@shops/${slug}`, "build"]);
  } else if (command === "owner-add") {
    await addOwner();
  } else if (command === "create") {
    rejectStoreCreation();
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
