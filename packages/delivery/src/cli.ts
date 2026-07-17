import { execFile, spawn } from "node:child_process";
import type { Dirent } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve as resolvePath, sep } from "node:path";
import { promisify } from "node:util";
import { parse as parseJsonc, type ParseError } from "jsonc-parser";
import { parse as parseYaml } from "yaml";
import * as v from "valibot";
import {
  D1DatabaseIdSchema,
  D1DatabaseNameSchema,
  DeliveryAuditEventIdSchema,
  DeliveryJournalSchema,
  DeliveryManifestSchema,
  DeploymentTargetNameSchema,
  DeliveryStaffIdSchema,
  DevProcessRecordSchema,
  ProofRecordSchema,
  StoreNameSchema,
  StoreSlugSchema,
  type DeliveryManifest,
  type DeliveryJournal,
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
  owner-add --store <slug> --email <email> [--local | --manifest <path> --target <name>]
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
const WranglerConfigSchema = v.object({
  d1_databases: v.array(
    v.object({
      binding: v.string(),
      database_name: D1DatabaseNameSchema,
      database_id: D1DatabaseIdSchema,
    }),
  ),
});
const RemoteD1ListSchema = v.array(
  v.object({ uuid: D1DatabaseIdSchema, name: v.pipe(v.string(), v.minLength(1)) }),
);

const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;
const hasCanonicalStaffIdSql =
  "length(staff_members.id) = 32 AND substr(staff_members.id, 1, 6) = 'staff_' AND substr(staff_members.id, 7, 1) GLOB '[0-7]' AND substr(staff_members.id, 7) NOT GLOB '*[^0123456789abcdefghjkmnpqrstvwxyz]*'";

const createOwnerStatement = async (email: string) => {
  const [{ stdout: staffIdSource }, { stdout: auditIdSource }] = await Promise.all([
    execFileOutput("pnpm", ["--silent", "staff:id:create"]),
    execFileOutput("pnpm", ["--silent", "audit:id:create"]),
  ]);
  const staffId = v.parse(DeliveryStaffIdSchema, staffIdSource.trim());
  const auditId = v.parse(DeliveryAuditEventIdSchema, auditIdSource.trim());
  const correlationId = randomUUID();
  const now = Date.now();
  const matchingStaffSql = `normalized_email = ${sqlString(email)}`;
  const staffNeedsOwnerProvisioningSql = `NOT (${hasCanonicalStaffIdSql}) OR staff_members.status <> 'active' OR staff_members.role IS NOT 'owner' OR staff_members.approved_at IS NULL OR staff_members.revoked_at IS NOT NULL`;
  const ownerProvisioningChangesAuthoritySql = `NOT EXISTS (SELECT 1 FROM staff_members WHERE ${matchingStaffSql}) OR EXISTS (SELECT 1 FROM staff_members WHERE ${matchingStaffSql} AND (${staffNeedsOwnerProvisioningSql}))`;
  const finalStaffId = `coalesce((SELECT CASE WHEN ${hasCanonicalStaffIdSql} THEN staff_members.id ELSE ${sqlString(staffId)} END FROM staff_members WHERE ${matchingStaffSql}), ${sqlString(staffId)})`;
  const metadata = `json_object('before', (SELECT json_object('status', status, 'role', role) FROM staff_members WHERE ${matchingStaffSql}), 'after', json_object('status', 'active', 'role', 'owner'))`;
  return `INSERT INTO audit_events (id, actor_kind, actor_id, staff_role, source_channel, action, outcome, entity_kind, entity_id, reason, command_correlation_id, metadata_json, created_at) SELECT ${sqlString(auditId)}, 'system', NULL, NULL, 'provisioning', 'staff.provision_owner', 'accepted', 'staff_member', ${finalStaffId}, NULL, ${sqlString(correlationId)}, ${metadata}, ${now} WHERE ${ownerProvisioningChangesAuthoritySql}; INSERT INTO staff_session_cleanup_debts (auth_user_id, staff_id, session_generation, operation, created_at, updated_at) SELECT auth_user_id, ${finalStaffId}, session_generation + 1, 'provision', ${now}, ${now} FROM staff_members WHERE ${matchingStaffSql} AND auth_user_id IS NOT NULL AND (${ownerProvisioningChangesAuthoritySql}) ON CONFLICT(auth_user_id) DO UPDATE SET staff_id = excluded.staff_id, session_generation = excluded.session_generation, operation = excluded.operation, updated_at = excluded.updated_at; INSERT INTO staff_members (id, normalized_email, auth_user_id, status, role, session_generation, created_at, updated_at, approved_at, revoked_at) VALUES (${sqlString(staffId)}, ${sqlString(email)}, NULL, 'active', 'owner', 0, ${now}, ${now}, ${now}, NULL) ON CONFLICT(normalized_email) DO UPDATE SET id = CASE WHEN ${hasCanonicalStaffIdSql} THEN staff_members.id ELSE excluded.id END, status = 'active', role = 'owner', session_generation = staff_members.session_generation + 1, approved_at = excluded.approved_at, revoked_at = NULL, updated_at = excluded.updated_at WHERE ${ownerProvisioningChangesAuthoritySql}`;
};

const readAppD1Resource = async (slug: string) => {
  const source = await readFile(join("apps", slug, "wrangler.jsonc"), "utf8");
  const errors: ParseError[] = [];
  const parsed: unknown = parseJsonc(source, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    throw new Error(`Store ${slug} has invalid Wrangler JSONC`);
  }
  const config = v.parse(WranglerConfigSchema, parsed);
  const resources = config.d1_databases.filter(({ binding }) => binding === "DB");
  if (resources.length !== 1) {
    throw new Error(`Store ${slug} must declare exactly one DB binding`);
  }
  const resource = resources.at(0);
  if (!resource) {
    throw new Error(`Store ${slug} has no DB binding`);
  }
  return { name: resource.database_name, databaseId: resource.database_id };
};

const parseDeliveryJournal = (source: string) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("Remote Owner target has a legacy or invalid delivery journal");
  }
  const result = v.safeParse(DeliveryJournalSchema, parsed);
  if (!result.success) {
    throw new Error("Remote Owner target has a legacy or invalid delivery journal");
  }
  return result.output;
};

const isMissingFile = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

type CanonicalDirectory = {
  readonly path: string;
  readonly realPath: string;
};

const resolveCanonicalDirectory = async (
  directory: string,
  missingAllowed: boolean,
  invalidMessage: string,
): Promise<CanonicalDirectory | undefined> => {
  const path = resolvePath(directory);
  let status;
  try {
    status = await lstat(path);
  } catch (error) {
    if (missingAllowed && isMissingFile(error)) {
      return undefined;
    }
    throw new Error(invalidMessage, { cause: error });
  }
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error(invalidMessage);
  }
  try {
    return { path, realPath: await realpath(path) };
  } catch {
    throw new Error(invalidMessage);
  }
};

const isContainedPath = (root: string, path: string) => {
  const remainder = relative(root, path);
  return (
    remainder === "" ||
    (remainder !== ".." && !remainder.startsWith(`..${sep}`) && !isAbsolute(remainder))
  );
};

const readCanonicalDeliveryJournal = async (
  targetName: string,
  missingAllowed: boolean,
  knownRoot?: CanonicalDirectory,
) => {
  const validTargetName = v.parse(DeploymentTargetNameSchema, targetName);
  const root =
    knownRoot ??
    (await resolveCanonicalDirectory(
      ".delivery",
      missingAllowed,
      "Canonical delivery journal evidence root is invalid",
    ));
  if (!root) {
    return undefined;
  }
  const path = resolvePath(root.path, `${validTargetName}.journal.json`);
  if (!isContainedPath(root.path, path)) {
    throw new Error("Canonical delivery journal evidence path is invalid");
  }
  let status;
  try {
    status = await lstat(path);
  } catch (error) {
    if (missingAllowed && isMissingFile(error)) {
      return undefined;
    }
    throw new Error("Remote Owner target lacks a deployed delivery journal", { cause: error });
  }
  if (status.isSymbolicLink() || !status.isFile()) {
    throw new Error("Canonical delivery journal evidence file is invalid");
  }
  let canonicalPath: string;
  try {
    canonicalPath = await realpath(path);
  } catch {
    throw new Error("Canonical delivery journal evidence file is invalid");
  }
  if (!isContainedPath(root.realPath, canonicalPath)) {
    throw new Error("Canonical delivery journal evidence path is invalid");
  }
  let source: string;
  try {
    source = await readFile(canonicalPath, "utf8");
  } catch {
    throw new Error("Canonical delivery journal evidence file is invalid");
  }
  return parseDeliveryJournal(source);
};

const readDeliveryJournal = async (targetName: string) => {
  const journal = await readCanonicalDeliveryJournal(targetName, false);
  if (!journal) {
    throw new Error("Remote Owner target lacks a deployed delivery journal");
  }
  return journal;
};

const privateManifestLimit = 100;

const readPrivateManifestPaths = async () => {
  const root = await resolveCanonicalDirectory(
    ".private",
    true,
    "Canonical private delivery evidence root is invalid",
  );
  if (!root) {
    return [];
  }
  const paths: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      throw new Error("Canonical private delivery evidence cannot be read");
    }
    for (const entry of entries) {
      const path = resolvePath(directory, entry.name);
      let status;
      try {
        status = await lstat(path);
      } catch {
        throw new Error("Canonical private delivery evidence cannot be read");
      }
      if (entry.isSymbolicLink() || status.isSymbolicLink()) {
        continue;
      }
      if (entry.isDirectory() && status.isDirectory()) {
        let canonicalPath: string;
        try {
          canonicalPath = await realpath(path);
        } catch {
          throw new Error("Canonical private delivery evidence cannot be read");
        }
        if (!isContainedPath(root.realPath, canonicalPath)) {
          throw new Error("Canonical private delivery evidence escapes its root");
        }
        await visit(canonicalPath);
      } else if (entry.isFile() && status.isFile() && /\.ya?ml$/.test(entry.name)) {
        let canonicalPath: string;
        try {
          canonicalPath = await realpath(path);
        } catch {
          throw new Error("Canonical private Production manifest evidence is malformed");
        }
        if (!isContainedPath(root.realPath, canonicalPath)) {
          throw new Error("Canonical private delivery evidence escapes its root");
        }
        paths.push(canonicalPath);
        if (paths.length > privateManifestLimit) {
          throw new Error("Canonical private delivery evidence exceeds its bounded file limit");
        }
      }
    }
  };
  await visit(root.realPath);
  return paths.toSorted();
};

const resolveCanonicalRemoteTarget = async (slug: string) => {
  const privateManifestPaths = await readPrivateManifestPaths();
  const deliveryRoot = await resolveCanonicalDirectory(
    ".delivery",
    true,
    "Canonical delivery journal evidence root is invalid",
  );
  const candidates: Array<Awaited<ReturnType<typeof readTarget>>> = [];
  for (const path of privateManifestPaths) {
    let input: ManifestInput;
    try {
      input = await readManifestPath(path);
    } catch {
      throw new Error("Canonical private Production manifest evidence is malformed");
    }
    for (const [targetName, target] of Object.entries(input.manifest.targets)) {
      if (target.kind !== "production" || targetSlug(target.app) !== slug) {
        continue;
      }
      if (!deliveryRoot) {
        continue;
      }
      const journal = await readCanonicalDeliveryJournal(targetName, true, deliveryRoot);
      if (!journal) {
        continue;
      }
      if (
        journal.target !== targetName ||
        journal.app !== target.app ||
        journal.manifestDigest !== input.digest ||
        !journal.completedSteps.includes("remote-deploy")
      ) {
        throw new Error(
          "Canonical remote Owner evidence does not match its target, app, manifest, or deployment step",
        );
      }
      candidates.push({ targetName, target, manifestDigest: input.digest });
    }
  }
  const candidate = candidates.length === 1 ? candidates.at(0) : undefined;
  if (!candidate) {
    throw new Error(
      candidates.length === 0
        ? `Store ${slug} has no canonical private Production Owner target evidence`
        : `Store ${slug} has ambiguous private Production Owner target evidence`,
    );
  }
  return candidate;
};

const isCommitAncestor = (ancestor: string, descendant: string) =>
  new Promise<boolean>((resolve, reject) => {
    const child = spawn("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      stdio: "ignore",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve(true);
      } else if (code === 1) {
        resolve(false);
      } else {
        reject(new Error("Recorded deployment commit is invalid or unavailable"));
      }
    });
  });

const verifyRemoteD1Resource = async (
  app: string,
  recorded: DeliveryJournal["resources"]["d1"],
) => {
  const { stdout } = await execFileOutput("pnpm", [
    "--filter",
    app,
    "exec",
    "wrangler",
    "d1",
    "list",
    "--json",
  ]);
  const parsed: unknown = JSON.parse(stdout);
  const resources = v.parse(RemoteD1ListSchema, parsed);
  const candidates = resources.filter(
    ({ name, uuid }) => name === recorded.name || uuid === recorded.databaseId,
  );
  const verified = candidates.length === 1 ? candidates.at(0) : undefined;
  if (!verified || verified.name !== recorded.name || verified.uuid !== recorded.databaseId) {
    throw new Error("Remote D1 identity does not match the recorded delivery resource");
  }
};

const addOwner = async () => {
  const slug = v.parse(StoreSlugSchema, requireOption("--store"));
  const email = v.parse(SqlEmailSchema, requireOption("--email"));
  const hasManifestOverride = args.includes("--manifest");
  const hasTargetOverride = args.includes("--target");
  if (args.includes("--local")) {
    if (hasManifestOverride || hasTargetOverride) {
      throw new Error("Owner provisioning accepts either --local or a manifest target, not both");
    }
    const localStore = await resolveLocalStore(slug);
    const statement = await createOwnerStatement(email);
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

  if (hasManifestOverride !== hasTargetOverride) {
    throw new Error("Remote Owner manifest and target overrides must be provided together");
  }
  const { targetName, target, manifestDigest } = hasManifestOverride
    ? await readTarget()
    : await resolveCanonicalRemoteTarget(slug);
  if (target.kind === "prospect-demo") {
    throw new Error("Owner provisioning is unavailable for prospect-demo targets");
  }
  if (target.kind === "local" || targetSlug(target.app) !== slug) {
    throw new Error("Remote Owner target does not match the selected deployed Store");
  }
  const journal = await readDeliveryJournal(targetName);
  const commit = await readCommitIdentity();
  const expectedD1Name = `${target.resourcePrefix}-db`;
  const compatibleCommit = await isCommitAncestor(journal.commit, commit);
  if (
    journal.target !== targetName ||
    journal.app !== target.app ||
    !compatibleCommit ||
    journal.manifestDigest !== manifestDigest ||
    journal.resources.d1.name !== expectedD1Name ||
    !journal.completedSteps.includes("remote-deploy")
  ) {
    throw new Error(
      "Remote Owner target does not match the journal target, app, manifest, commit, or D1 name",
    );
  }
  await verifyRemoteD1Resource(target.app, journal.resources.d1);
  const remoteConfigDirectory = await mkdtemp(join(tmpdir(), "ecom-owner-provisioning-"));
  try {
    await chmod(remoteConfigDirectory, 0o700);
    const remoteConfigPath = join(remoteConfigDirectory, "wrangler.json");
    await writeFile(
      remoteConfigPath,
      JSON.stringify({
        name: "owner-provisioning",
        compatibility_date: "2026-07-08",
        d1_databases: [
          {
            binding: "DB",
            database_name: journal.resources.d1.name,
            database_id: journal.resources.d1.databaseId,
          },
        ],
      }),
      { flag: "wx", mode: 0o600 },
    );
    const statement = await createOwnerStatement(email);
    await run("pnpm", [
      "exec",
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--config",
      remoteConfigPath,
      "--remote",
      "--command",
      statement,
    ]);
  } finally {
    await rm(remoteConfigDirectory, { recursive: true, force: true });
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
