import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { parse as parseYaml } from "yaml";
import * as v from "valibot";
import {
  D1DatabaseIdSchema,
  D1DatabaseNameSchema,
  DeliveryJournalSchema,
  DeliveryManifestSchema,
  DeploymentTargetNameSchema,
  DevProcessRecordSchema,
  ProofRecordSchema,
  StoreNameSchema,
  StoreSlugSchema,
  type DeliveryManifest,
} from "./index";
import { parsePortlessOrigin, readCommitIdentity, resolveLocalStore } from "./portless";
import { runProofAuth } from "./proof-auth";
import { readAppD1Resource, withWranglerWorker } from "./wrangler-worker";

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
  owner-add --store <slug> --email <email> [--local | --manifest <path> --target <name>]
  proof-auth --store <slug> --email <email> --vars <absolute-mode-0600-path> [--persist-to <absolute-path>] [--origin <https-origin>]
  proof-auth --cleanup --store <slug> --vars <absolute-mode-0600-path> [--persist-to <absolute-path>] [--origin <https-origin>]
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
  new Promise<void>((resolveRun, reject) => {
    const child = spawn(executable, commandArgs, { env: environment, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        reject(new Error(`${executable} exited with ${code ?? "no status"}`));
      }
    });
  });

type ManifestInput = {
  readonly manifest: DeliveryManifest;
  readonly digest: string;
};

const readManifestPath = async (path: string): Promise<ManifestInput> => {
  const source = await readFile(path, "utf8");
  const parsed: unknown = parseYaml(source);
  return {
    manifest: v.parse(DeliveryManifestSchema, parsed),
    digest: createHash("sha256").update(source).digest("hex"),
  };
};

const readManifest = () => readManifestPath(requireOption("--manifest"));

const readTarget = async () => {
  const { manifest, digest } = await readManifest();
  const targetName = v.parse(DeploymentTargetNameSchema, requireOption("--target"));
  const target = manifest.targets[targetName];
  if (!target) {
    throw new Error(`Unknown target: ${targetName}`);
  }
  return { targetName, target, manifestDigest: digest };
};

const targetSlug = (app: string) => v.parse(StoreSlugSchema, app.slice("@shops/".length));
const journalPath = (targetName: string) =>
  join(".delivery", `${v.parse(DeploymentTargetNameSchema, targetName)}.journal.json`);
const proofPath = (targetName: string) =>
  join(".delivery", `${v.parse(DeploymentTargetNameSchema, targetName)}.proof.json`);
const devProcessPath = (slug: string) => join(".delivery", `${slug}.dev.json`);

const SqlEmailSchema = v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email());
const readDeliveryJournal = async (targetName: string) => {
  const source = await readFile(journalPath(targetName), "utf8");
  return v.parse(DeliveryJournalSchema, JSON.parse(source));
};

const RemoteD1InfoSchema = v.object({
  uuid: D1DatabaseIdSchema,
  name: D1DatabaseNameSchema,
});
const WorkerDeploymentSchema = v.object({
  versions: v.array(
    v.object({
      version_id: v.pipe(v.string(), v.uuid()),
      percentage: v.number(),
    }),
  ),
});
const WorkerVersionSchema = v.object({
  annotations: v.record(v.string(), v.string()),
});

const verifyRemoteOwnerTarget = async (
  workerName: string,
  commit: string,
  d1: { readonly name: string; readonly databaseId: string },
) => {
  const { stdout: d1Source } = await execFileOutput("pnpm", [
    "exec",
    "wrangler",
    "d1",
    "info",
    d1.name,
    "--json",
  ]);
  const remoteD1 = v.parse(RemoteD1InfoSchema, JSON.parse(d1Source));
  if (remoteD1.name !== d1.name || remoteD1.uuid !== d1.databaseId) {
    throw new Error("Deployed D1 resource does not match the delivery journal");
  }

  const { stdout: deploymentSource } = await execFileOutput("pnpm", [
    "exec",
    "wrangler",
    "deployments",
    "status",
    "--name",
    workerName,
    "--json",
  ]);
  const deployment = v.parse(WorkerDeploymentSchema, JSON.parse(deploymentSource));
  const activeVersion = deployment.versions.find(({ percentage }) => percentage === 100);
  if (!activeVersion || deployment.versions.length !== 1) {
    throw new Error("Deployed Worker does not have one active version");
  }
  const { stdout: versionSource } = await execFileOutput("pnpm", [
    "exec",
    "wrangler",
    "versions",
    "view",
    activeVersion.version_id,
    "--name",
    workerName,
    "--json",
  ]);
  const version = v.parse(WorkerVersionSchema, JSON.parse(versionSource));
  if (
    version.annotations["workers/message"] !== commit &&
    version.annotations["workers/tag"] !== commit
  ) {
    throw new Error("Deployed Worker commit does not match the delivery journal");
  }
};

const ownerProvisioningWorker = (token: string) => `
import { provisionOwner } from "../../packages/kernel/src/index";

export default {
  async fetch(request) {
    if (request.headers.get("authorization") !== ${JSON.stringify(`Bearer ${token}`)}) {
      return new Response("Unauthorized", { status: 401 });
    }
    const result = await provisionOwner(await request.text());
    if (result.isOk()) {
      return new Response("ok");
    }
    return new Response(
      result.error.code === "linked_identity"
        ? "Use Staff Admin to change authority for a linked identity"
        : "Owner provisioning is unavailable",
      { status: result.error.code === "linked_identity" ? 409 : 503 },
    );
  },
};
`;

const provisionOwner = async (
  email: string,
  configPath: string,
  mode: "local" | "remote",
  persistPath?: string,
) => {
  await mkdir(".delivery", { recursive: true });
  const directory = await mkdtemp(join(process.cwd(), ".delivery", "owner-provisioning-"));
  const entryPath = join(directory, "worker.ts");
  const token = randomUUID();
  await writeFile(entryPath, ownerProvisioningWorker(token), { flag: "wx", mode: 0o600 });
  const commandArgs = ["exec", "wrangler", "dev", entryPath, "--config", configPath];
  if (mode === "remote") {
    commandArgs.push("--remote");
  } else if (persistPath) {
    commandArgs.push("--persist-to", persistPath);
  }
  try {
    await withWranglerWorker(commandArgs, [token], async (endpoint) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: email,
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) {
        throw new Error(
          `Worker request failed: Owner provisioning returned HTTP ${response.status}`,
        );
      }
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const writeOwnerConfig = async (
  directory: string,
  d1: { readonly name: string; readonly databaseId: string },
) => {
  const configPath = join(directory, "wrangler.json");
  await writeFile(
    configPath,
    JSON.stringify({
      name: "owner-provisioning",
      compatibility_date: "2026-07-08",
      d1_databases: [{ binding: "DB", database_name: d1.name, database_id: d1.databaseId }],
    }),
    { flag: "wx", mode: 0o600 },
  );
  return configPath;
};

const addOwner = async () => {
  const slug = v.parse(StoreSlugSchema, requireOption("--store"));
  const email = v.parse(SqlEmailSchema, requireOption("--email"));
  if (args.includes("--local")) {
    if (args.includes("--manifest") || args.includes("--target")) {
      throw new Error("Owner provisioning accepts either --local or a manifest target, not both");
    }
    const localStore = await resolveLocalStore(slug);
    const directory = await mkdtemp(join(tmpdir(), "ecom-owner-provisioning-"));
    try {
      await chmod(directory, 0o700);
      const configPath = await writeOwnerConfig(
        directory,
        await readAppD1Resource(localStore.slug),
      );
      await provisionOwner(
        email,
        configPath,
        "local",
        join("apps", localStore.slug, ".wrangler", "state"),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
    write(`Provisioned active Owner ${email} for local Store ${localStore.slug}`);
    return;
  }

  if (!args.includes("--manifest") || !args.includes("--target")) {
    throw new Error("Remote Owner provisioning requires --manifest <path> and --target <name>");
  }
  const { targetName, target, manifestDigest } = await readTarget();
  if (target.kind !== "production" || targetSlug(target.app) !== slug) {
    throw new Error("Owner provisioning requires the selected Store's Production target");
  }
  const journal = await readDeliveryJournal(targetName);
  if (
    journal.target !== targetName ||
    journal.app !== target.app ||
    journal.manifestDigest !== manifestDigest ||
    journal.resources.d1.name !== `${target.resourcePrefix}-db` ||
    !journal.completedSteps.includes("remote-deploy")
  ) {
    throw new Error("Remote Owner target does not match its manifest and delivery journal");
  }

  await verifyRemoteOwnerTarget(target.workerName, journal.commit, journal.resources.d1);

  const directory = await mkdtemp(join(tmpdir(), "ecom-owner-provisioning-"));
  try {
    await chmod(directory, 0o700);
    const configPath = await writeOwnerConfig(directory, journal.resources.d1);
    await provisionOwner(email, configPath, "remote");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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
  const { targetName, target, manifestDigest } = await readTarget();
  if (target.kind !== "local") {
    throw new Error(`Remote apply is intentionally unavailable for ${target.kind}`);
  }
  const localStore = await resolveLocalStore(targetSlug(target.app));
  const commit = await readCommitIdentity();
  await run("pnpm", ["--filter", target.app, "db:migrate:local"]);
  await mkdir(".delivery", { recursive: true });
  const journal = v.parse(DeliveryJournalSchema, {
    schemaVersion: 2,
    target: targetName,
    app: target.app,
    commit,
    manifestDigest,
    origin: localStore.origin,
    resources: { d1: await readAppD1Resource(localStore.slug) },
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
  const { targetName, target, manifestDigest } = await readTarget();
  if (target.kind !== "local") {
    throw new Error("Remote proof requires deployed infrastructure");
  }
  const journal = await readDeliveryJournal(targetName);
  const commit = await readCommitIdentity();
  const localStore = await resolveLocalStore(targetSlug(target.app));
  const d1 = await readAppD1Resource(localStore.slug);
  if (
    journal.target !== targetName ||
    journal.app !== target.app ||
    journal.commit !== commit ||
    journal.manifestDigest !== manifestDigest ||
    journal.origin !== localStore.origin ||
    journal.resources.d1.name !== d1.name ||
    journal.resources.d1.databaseId !== d1.databaseId ||
    !journal.completedSteps.includes("local-migrations")
  ) {
    throw new Error(
      "Local apply journal does not match the selected target, checkout, manifest, and D1 resource",
    );
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
    const { manifest } = await readManifest();
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
  } else if (command === "proof-auth") {
    await runProofAuth({
      cleanup: args.includes("--cleanup"),
      store: requireOption("--store"),
      email: option("--email"),
      vars: requireOption("--vars"),
      persistTo: option("--persist-to"),
      origin: option("--origin"),
    });
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
