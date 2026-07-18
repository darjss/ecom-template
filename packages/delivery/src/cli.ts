import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { parse as parseJsonc, type ParseError } from "jsonc-parser";
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
const WranglerConfigSchema = v.object({
  d1_databases: v.array(
    v.object({
      binding: v.string(),
      database_name: D1DatabaseNameSchema,
      database_id: D1DatabaseIdSchema,
    }),
  ),
  kv_namespaces: v.array(
    v.object({
      binding: v.string(),
      id: v.pipe(v.string(), v.minLength(1)),
    }),
  ),
});

const readAppResources = async (slug: string) => {
  const source = await readFile(join("apps", slug, "wrangler.jsonc"), "utf8");
  const errors: ParseError[] = [];
  const parsed: unknown = parseJsonc(source, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    throw new Error(`Store ${slug} has invalid Wrangler JSONC`);
  }
  const config = v.parse(WranglerConfigSchema, parsed);
  const databases = config.d1_databases.filter(({ binding }) => binding === "DB");
  const namespaces = config.kv_namespaces.filter(({ binding }) => binding === "EPHEMERAL_KV");
  const database = databases.at(0);
  const namespace = namespaces.at(0);
  if (databases.length !== 1 || !database) {
    throw new Error(`Store ${slug} must declare exactly one DB binding`);
  }
  if (namespaces.length !== 1 || !namespace) {
    throw new Error(`Store ${slug} must declare exactly one EPHEMERAL_KV binding`);
  }
  return {
    d1: { name: database.database_name, databaseId: database.database_id },
    ephemeralKvId: namespace.id,
  };
};

const readAppD1Resource = async (slug: string) => (await readAppResources(slug)).d1;

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

const selectAvailablePort = () =>
  new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not select a local Worker port"));
        return;
      }
      server.close((error) => (error ? reject(error) : resolvePort(address.port)));
    });
  });

const withWranglerWorker = async <T>(
  commandArgs: string[],
  redactedValues: readonly string[],
  operation: (endpoint: string) => Promise<T>,
) => {
  const port = await selectAvailablePort();
  commandArgs.push("--ip", "127.0.0.1", "--port", String(port));
  const child = spawn("pnpm", commandArgs, {
    detached: true,
    stdio: ["ignore", "ignore", "pipe"],
  });
  const closed = new Promise<void>((resolveClosed) => {
    child.once("close", () => resolveClosed());
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr = `${stderr}${chunk}`.slice(-4_000);
  });
  const sanitizedError = () =>
    redactedValues.reduce(
      (message, value) => message.replaceAll(value, "[redacted]"),
      stderr.trim(),
    );
  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(sanitizedError() || "Local Worker failed to start");
      }
      try {
        return await operation(`http://127.0.0.1:${port}`);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Worker request failed")) {
          throw error;
        }
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
      }
    }
    throw new Error(sanitizedError() || "Local Worker did not become ready");
  } finally {
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        if (child.exitCode === null) {
          child.kill();
        }
      }
    }
    let shutdownTimeout: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      closed,
      new Promise<void>((resolveTimeout) => {
        shutdownTimeout = setTimeout(resolveTimeout, 5_000);
      }),
    ]);
    if (shutdownTimeout) {
      clearTimeout(shutdownTimeout);
    }
    if (child.exitCode === null && child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        if (child.exitCode === null) {
          child.kill("SIGKILL");
        }
      }
      await closed;
    }
  }
};

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

const ProofOriginSchema = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    );
  }),
);
const ProofSessionResponseSchema = v.object({
  email: SqlEmailSchema,
  expiresAt: v.pipe(v.string(), v.isoTimestamp()),
  role: v.literal("owner"),
  staffId: v.string(),
});
const ProofHandoffSchema = v.object({
  origin: ProofOriginSchema,
  statePath: v.string(),
  email: SqlEmailSchema,
  cookieJarPath: v.string(),
  browserStatePath: v.string(),
  sessionExpiresAt: v.pipe(v.string(), v.isoTimestamp()),
});
const BrowserStateSchema = v.object({
  cookies: v.tuple([
    v.object({
      name: v.pipe(v.string(), v.regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/)),
      value: v.pipe(
        v.string(),
        v.check((value) =>
          [...value].every((character) => {
            const code = character.charCodeAt(0);
            return character !== ";" && code > 31 && code !== 127;
          }),
        ),
      ),
      domain: v.string(),
      path: v.literal("/"),
      expires: v.number(),
      httpOnly: v.literal(true),
      secure: v.literal(true),
      sameSite: v.literal("Lax"),
    }),
  ]),
  origins: v.tuple([]),
});

type ProofAuthInput = {
  readonly slug: string;
  readonly origin: string;
  readonly persistPath: string;
  readonly varsPath: string;
};

const requireAbsolutePath = (name: string, value: string) => {
  if (!isAbsolute(value)) {
    throw new Error(`${name} must be an absolute path`);
  }
  return resolve(value);
};

const requireRegularMode600File = async (path: string, label: string) => {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o777) !== 0o600) {
    throw new Error(`${label} must be a regular mode-0600 file`);
  }
};

const requireSafeDirectory = async (path: string, label: string) => {
  try {
    const metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error(`${label} must be a regular directory`);
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
};

const readRedactedValues = async (path: string) => {
  const source = await readFile(path, "utf8");
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#") && line.includes("="))
    .map((line) =>
      line
        .slice(line.indexOf("=") + 1)
        .trim()
        .replace(/^(['"])(.*)\1$/, "$2"),
    )
    .filter((value) => value !== "");
};

const writeAtomic = async (path: string, content: string) => {
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, content, { flag: "wx", mode: 0o600 });
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
};

const readProofAuthInput = async (): Promise<ProofAuthInput> => {
  const slug = v.parse(StoreSlugSchema, requireOption("--store"));
  const localStore = await resolveLocalStore(slug);
  const origin = v.parse(ProofOriginSchema, option("--origin") ?? localStore.origin);
  const varsPath = requireAbsolutePath("--vars", requireOption("--vars"));
  await requireRegularMode600File(varsPath, "Proof vars");
  const persistPath = option("--persist-to")
    ? requireAbsolutePath("--persist-to", requireOption("--persist-to"))
    : resolve("apps", slug, ".wrangler", "state");
  await requireSafeDirectory(persistPath, "Wrangler state");
  return { slug, origin, persistPath, varsPath };
};

const proofArtifactDirectory = (slug: string) => resolve(".delivery", "proof", slug);

const requireProofArtifactsAbsent = async (slug: string) => {
  const directory = proofArtifactDirectory(slug);
  try {
    await lstat(directory);
    throw new Error(`Proof artifacts already exist; clean ${directory} before creating a session`);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
};

const prepareProofArtifactDirectory = async (slug: string) => {
  const directory = proofArtifactDirectory(slug);
  await requireSafeDirectory(resolve(".delivery", "proof"), "Proof artifact root");
  await requireProofArtifactsAbsent(slug);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(resolve(".delivery", "proof"), 0o700);
  await chmod(directory, 0o700);
  return directory;
};

const writeProofWorkerConfig = async (directory: string, slug: string, token: string) => {
  const resources = await readAppResources(slug);
  const path = join(directory, "wrangler.json");
  await writeFile(
    path,
    JSON.stringify({
      name: `proof-auth-${slug}`,
      compatibility_date: "2026-07-08",
      compatibility_flags: ["nodejs_compat"],
      d1_databases: [
        {
          binding: "DB",
          database_name: resources.d1.name,
          database_id: resources.d1.databaseId,
        },
      ],
      kv_namespaces: [{ binding: "EPHEMERAL_KV", id: resources.ephemeralKvId }],
      vars: { PROOF_CONTROL_TOKEN: token },
    }),
    { flag: "wx", mode: 0o600 },
  );
  return path;
};

const requestProofWorker = async (
  input: ProofAuthInput,
  body:
    | { readonly action: "create"; readonly email: string; readonly origin: string }
    | {
        readonly action: "revoke";
        readonly cookie: string;
        readonly origin: string;
      },
) => {
  const directory = await mkdtemp(join(tmpdir(), "ecom-proof-auth-"));
  await chmod(directory, 0o700);
  const token = randomUUID();
  try {
    const configPath = await writeProofWorkerConfig(directory, input.slug, token);
    return await withWranglerWorker(
      [
        "exec",
        "wrangler",
        "dev",
        resolve("packages", "kernel", "src", "auth", "proof-auth-worker.ts"),
        "--config",
        configPath,
        "--env-file",
        input.varsPath,
        "--persist-to",
        input.persistPath,
      ],
      [token, input.varsPath, ...(await readRedactedValues(input.varsPath))],
      async (endpoint) => {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) {
          throw new Error(`Worker request failed: proof auth returned HTTP ${response.status}`);
        }
        return response;
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const readSessionCookie = (setCookie: string) => {
  const pair = setCookie.slice(0, setCookie.indexOf(";"));
  const separator = pair.indexOf("=");
  if (separator <= 0) {
    throw new Error("Proof Worker returned an invalid session cookie");
  }
  return { name: pair.slice(0, separator), value: pair.slice(separator + 1), pair };
};

const curlStatus = async (url: string, cookieJarPath: string) => {
  const { stdout } = await execFileOutput("curl", [
    "--silent",
    "--show-error",
    "--output",
    "/dev/null",
    "--write-out",
    "%{http_code}",
    "--cookie",
    cookieJarPath,
    url,
  ]);
  return Number(stdout);
};

const verifyAdminSession = async (origin: string, cookieJarSource: string) => {
  const directory = await mkdtemp(join(tmpdir(), "ecom-proof-cookie-"));
  await chmod(directory, 0o700);
  const cookieJarPath = join(directory, "cookies.txt");
  try {
    await writeFile(cookieJarPath, cookieJarSource, { flag: "wx", mode: 0o600 });
    const [adminStatus, staffStatus] = await Promise.all([
      curlStatus(`${origin}/admin`, cookieJarPath),
      curlStatus(`${origin}/api/staff`, cookieJarPath),
    ]);
    if (adminStatus !== 200 || staffStatus !== 200) {
      throw new Error(`Admin session verification failed with HTTP ${adminStatus}/${staffStatus}`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const issueProofAuth = async () => {
  const input = await readProofAuthInput();
  await requireProofArtifactsAbsent(input.slug);
  const email = v.parse(SqlEmailSchema, requireOption("--email"));
  const response = await requestProofWorker(input, {
    action: "create",
    email,
    origin: input.origin,
  });
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Proof Worker did not return a session cookie");
  }
  const session = v.parse(ProofSessionResponseSchema, await response.json());
  const cookie = readSessionCookie(setCookie);
  const url = new URL(input.origin);
  const expires = Math.floor(new Date(session.expiresAt).getTime() / 1_000);
  const cookieJarSource = `# Netscape HTTP Cookie File\n${url.hostname}\tFALSE\t/\tTRUE\t${expires}\t${cookie.name}\t${cookie.value}\n`;
  try {
    await verifyAdminSession(input.origin, cookieJarSource);
  } catch (error) {
    await requestProofWorker(input, {
      action: "revoke",
      cookie: cookie.pair,
      origin: input.origin,
    });
    throw error;
  }

  const directory = await (async () => {
    try {
      return await prepareProofArtifactDirectory(input.slug);
    } catch (error) {
      await requestProofWorker(input, {
        action: "revoke",
        cookie: cookie.pair,
        origin: input.origin,
      });
      throw error;
    }
  })();
  const cookieJarPath = join(directory, "cookies.txt");
  const browserStatePath = join(directory, "browser-state.json");
  const handoffPath = join(directory, "handoff.json");
  const browserState = v.parse(BrowserStateSchema, {
    cookies: [
      {
        name: cookie.name,
        value: cookie.value,
        domain: url.hostname,
        path: "/",
        expires,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ],
    origins: [],
  });
  const handoff = v.parse(ProofHandoffSchema, {
    origin: input.origin,
    statePath: input.persistPath,
    email: session.email,
    cookieJarPath,
    browserStatePath,
    sessionExpiresAt: session.expiresAt,
  });
  try {
    await writeAtomic(cookieJarPath, cookieJarSource);
    await writeAtomic(browserStatePath, `${JSON.stringify(browserState, null, 2)}\n`);
    await writeAtomic(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`);
  } catch (error) {
    await requestProofWorker(input, {
      action: "revoke",
      cookie: cookie.pair,
      origin: input.origin,
    });
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  write(`Prepared Staff Owner proof session for ${session.email} at ${input.origin}`);
  write(`Cookie jar: ${cookieJarPath}`);
  write(`Browser state: ${browserStatePath}`);
  write(`Handoff: ${handoffPath}`);
};

const cleanupProofAuth = async () => {
  const input = await readProofAuthInput();
  const directory = proofArtifactDirectory(input.slug);
  await requireSafeDirectory(directory, "Store proof artifact directory");
  const handoffPath = join(directory, "handoff.json");
  await requireRegularMode600File(handoffPath, "Proof handoff");
  const handoff = v.parse(ProofHandoffSchema, JSON.parse(await readFile(handoffPath, "utf8")));
  if (
    handoff.origin !== input.origin ||
    handoff.statePath !== input.persistPath ||
    handoff.cookieJarPath !== join(directory, "cookies.txt") ||
    handoff.browserStatePath !== join(directory, "browser-state.json")
  ) {
    throw new Error("Proof cleanup paths, origin, or Wrangler state do not match the handoff");
  }
  await requireRegularMode600File(handoff.browserStatePath, "Browser cookie state");
  const browserState = v.parse(
    BrowserStateSchema,
    JSON.parse(await readFile(handoff.browserStatePath, "utf8")),
  );
  const cookie = browserState.cookies[0];
  const cookiePair = `${cookie.name}=${cookie.value}`;
  await requestProofWorker(input, {
    action: "revoke",
    cookie: cookiePair,
    origin: input.origin,
  });
  try {
    const status = await curlStatus(`${input.origin}/api/staff`, handoff.cookieJarPath);
    if (status !== 401) {
      throw new Error(`Revoked Admin session remained usable with HTTP ${status}`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  write(`Revoked proof session for ${handoff.email} and erased ${directory}`);
};

const runProofAuth = async () => {
  if (args.includes("--cleanup")) {
    if (args.includes("--email")) {
      throw new Error("Proof auth cleanup reads the email from its handoff");
    }
    await cleanupProofAuth();
    return;
  }
  await issueProofAuth();
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
    await runProofAuth();
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
