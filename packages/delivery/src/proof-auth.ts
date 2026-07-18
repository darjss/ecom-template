import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import * as v from "valibot";
import { StoreSlugSchema } from "./index";
import { parseStorePortlessOrigin, requirePortlessRoute, resolveLocalStore } from "./portless";
import { readAppResources, withWranglerWorker } from "./wrangler-worker";

const execFileOutput = promisify(execFile);
const write = (value: string) => process.stdout.write(`${value}\n`);

export type ProofAuthOptions = {
  readonly cleanup: boolean;
  readonly store: string;
  readonly email: string | undefined;
  readonly vars: string;
  readonly persistTo: string | undefined;
  readonly origin: string | undefined;
};

const SqlEmailSchema = v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email());
const ProofOriginSchema = v.pipe(v.string(), v.url());
const ProofSessionResponseSchema = v.object({
  email: SqlEmailSchema,
  expiresAt: v.pipe(v.string(), v.isoTimestamp()),
  role: v.literal("owner"),
  staffId: v.string(),
  activeSessionCount: v.literal(1),
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

const readProofAuthInput = async (options: ProofAuthOptions): Promise<ProofAuthInput> => {
  const slug = v.parse(StoreSlugSchema, options.store);
  const localStore = await resolveLocalStore(slug);
  const origin = parseStorePortlessOrigin(options.origin ?? localStore.origin, slug);
  await requirePortlessRoute(origin);
  const varsPath = requireAbsolutePath("--vars", options.vars);
  await requireRegularMode600File(varsPath, "Proof vars");
  const persistPath = options.persistTo
    ? requireAbsolutePath("--persist-to", options.persistTo)
    : resolve("apps", slug, ".wrangler", "state");
  await requireSafeDirectory(persistPath, "Wrangler state");
  return { slug, origin, persistPath, varsPath };
};

const proofArtifactDirectory = (slug: string) => resolve(".delivery", "proof", slug);

const claimProofArtifactDirectory = async (slug: string) => {
  const root = resolve(".delivery", "proof");
  const directory = proofArtifactDirectory(slug);
  await requireSafeDirectory(root, "Proof artifact root");
  await mkdir(root, { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);
  try {
    await mkdir(directory, { mode: 0o700 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(
        `Proof artifacts already exist; clean ${directory} before creating a session`,
        { cause: error },
      );
    }
    throw error;
  }
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

const issueProofAuth = async (options: ProofAuthOptions) => {
  const input = await readProofAuthInput(options);
  const email = v.parse(SqlEmailSchema, options.email);
  const directory = await claimProofArtifactDirectory(input.slug);
  let mintedCookie: ReturnType<typeof readSessionCookie> | undefined;
  try {
    const response = await requestProofWorker(input, {
      action: "create",
      email,
      origin: input.origin,
    });
    const setCookie = response.headers.get("set-cookie");
    if (!setCookie) {
      throw new Error("Proof Worker did not return a session cookie");
    }
    const cookie = readSessionCookie(setCookie);
    mintedCookie = cookie;
    const session = v.parse(ProofSessionResponseSchema, await response.json());
    const url = new URL(input.origin);
    const expires = Math.floor(new Date(session.expiresAt).getTime() / 1_000);
    const cookieJarSource = `# Netscape HTTP Cookie File\n${url.hostname}\tFALSE\t/\tTRUE\t${expires}\t${cookie.name}\t${cookie.value}\n`;
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
    await writeAtomic(cookieJarPath, cookieJarSource);
    await writeAtomic(browserStatePath, `${JSON.stringify(browserState, null, 2)}\n`);
    await writeAtomic(handoffPath, `${JSON.stringify(handoff, null, 2)}\n`);
    await verifyAdminSession(input.origin, cookieJarSource);
    write(`Prepared Staff Owner proof session for ${session.email} at ${input.origin}`);
    write(`Cookie jar: ${cookieJarPath}`);
    write(`Browser state: ${browserStatePath}`);
    write(`Handoff: ${handoffPath}`);
  } catch (error) {
    if (mintedCookie) {
      try {
        await requestProofWorker(input, {
          action: "revoke",
          cookie: mintedCookie.pair,
          origin: input.origin,
        });
      } catch (revokeError) {
        throw new Error(
          `Proof issuance failed after minting; cleanup claim preserved at ${directory}`,
          { cause: revokeError },
        );
      }
    }
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
};

const cleanupProofAuth = async (options: ProofAuthOptions) => {
  const input = await readProofAuthInput(options);
  const directory = proofArtifactDirectory(input.slug);
  await requireSafeDirectory(directory, "Store proof artifact directory");
  const handoffPath = join(directory, "handoff.json");
  await requireRegularMode600File(handoffPath, "Proof handoff");
  const handoff = v.parse(ProofHandoffSchema, JSON.parse(await readFile(handoffPath, "utf8")));
  parseStorePortlessOrigin(handoff.origin, input.slug);
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

export const runProofAuth = async (options: ProofAuthOptions) => {
  if (options.cleanup) {
    if (options.email !== undefined) {
      throw new Error("Proof auth cleanup reads the email from its handoff");
    }
    await cleanupProofAuth(options);
    return;
  }
  if (options.email === undefined) {
    throw new Error("Missing --email <value>");
  }
  await issueProofAuth(options);
};
