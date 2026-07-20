import type { StoreElysiaApp } from "@ecom/api";
import { treaty } from "@elysiajs/eden";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";
import * as v from "valibot";
import { referenceStoreFixture } from "./fixture";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../apps/urnuun-48");
const mediaRoot = join(appRoot, "public/media");

const parseArguments = (
  tokens: readonly string[],
): { readonly mode: "local" | "remote"; readonly persistencePath?: string } => {
  let mode: "local" | "remote" = "local";
  let modeSpecified = false;
  let persistencePath: string | undefined;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--local" || token === "--remote") {
      if (modeSpecified) {
        throw new Error("Seed mode may be specified only once");
      }
      mode = token === "--local" ? "local" : "remote";
      modeSpecified = true;
      continue;
    }
    if (token === "--persist-to") {
      if (persistencePath !== undefined) {
        throw new Error("--persist-to may be specified only once");
      }
      const value = tokens[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--persist-to requires a path");
      }
      persistencePath = v.parse(v.pipe(v.string(), v.minLength(1)), value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown seed argument: ${token ?? ""}`);
  }
  if (mode === "remote" && persistencePath !== undefined) {
    throw new Error("Remote seeding cannot use a local persistence path");
  }
  return persistencePath === undefined ? { mode } : { mode, persistencePath };
};

const seedArguments = parseArguments(process.argv.slice(2));
const localPort = 18_794;
const localOrigin = `http://urnuun-48.localhost:${localPort}`;
const localToken = crypto.randomUUID();
const remoteOrigin = () => {
  const value = new URL(v.parse(v.pipe(v.string(), v.url()), process.env.REFERENCE_STORE_ORIGIN));
  if (
    value.protocol !== "https:" ||
    value.username !== "" ||
    value.password !== "" ||
    value.pathname !== "/" ||
    value.search !== "" ||
    value.hash !== ""
  ) {
    throw new Error("REFERENCE_STORE_ORIGIN must be an HTTPS origin");
  }
  return value.origin;
};

const readResponse = async (response: Response, method: string, path: string) => {
  const text = await response.text();
  let body: unknown = null;
  if (text !== "") {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    const context =
      typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500);
    throw new Error(
      `${method} ${path} returned HTTP ${response.status}${context ? `: ${context}` : ""}`,
    );
  }
  return body;
};

const request = async (
  origin: string,
  path: string,
  method: "POST" | "PUT",
  body?: BodyInit,
  contentType?: string,
) => {
  const cookie =
    seedArguments.mode === "remote"
      ? v.parse(v.pipe(v.string(), v.minLength(1)), process.env.REFERENCE_STORE_STAFF_COOKIE)
      : undefined;
  const response = await fetch(new URL(path, origin), {
    method,
    headers: {
      ...(cookie ? { cookie, origin } : {}),
      ...(seedArguments.mode === "local" ? { "x-reference-store-local-token": localToken } : {}),
      ...(contentType ? { "content-type": contentType } : {}),
    },
    ...(body === undefined ? {} : { body }),
  });
  return readResponse(response, method, path);
};

const waitForLocalWorker = async (worker: ChildProcess) => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (worker.exitCode !== null) {
      throw new Error(`Local Worker exited with code ${worker.exitCode}`);
    }
    try {
      const response = await fetch(`${localOrigin}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("Local Worker did not become ready");
};

const startLocalWorker = async () => {
  const build = spawn("pnpm", ["--filter", "@shops/urnuun-48", "build"], {
    cwd: resolve(appRoot, "../.."),
    env: process.env,
    stdio: ["ignore", "inherit", "inherit"],
  });
  const buildCode = await new Promise<number>((resolveBuild, rejectBuild) => {
    build.on("error", rejectBuild);
    build.on("close", (code) => resolveBuild(code ?? 1));
  });
  if (buildCode !== 0) {
    throw new Error(`Store build exited with code ${buildCode}`);
  }
  const worker = spawn(
    "pnpm",
    [
      "exec",
      "wrangler",
      "dev",
      "--config",
      "dist/server/wrangler.json",
      "--local",
      "--port",
      String(localPort),
      "--var",
      `REFERENCE_STORE_LOCAL_TOKEN:${localToken}`,
      ...(seedArguments.persistencePath ? ["--persist-to", seedArguments.persistencePath] : []),
    ],
    { cwd: appRoot, env: process.env, stdio: ["ignore", "inherit", "inherit"] },
  );
  await waitForLocalWorker(worker);
  return worker;
};

type EdenResponse<Data> = {
  readonly data: Data | null;
  readonly error: { readonly value: unknown } | null;
  readonly status: number;
};

const requireEdenResponse = <Data>(
  response: EdenResponse<Data>,
  method: string,
  path: string,
): Data => {
  if (response.error || response.data === null) {
    const context = JSON.stringify(response.error?.value ?? null).slice(0, 500);
    throw new Error(
      `${method} ${path} returned HTTP ${response.status}${context ? `: ${context}` : ""}`,
    );
  }
  return response.data;
};

const createSeedClient = (origin: string) =>
  treaty<StoreElysiaApp>(origin, {
    headers:
      seedArguments.mode === "local"
        ? { "x-reference-store-local-token": localToken }
        : {
            cookie: v.parse(
              v.pipe(v.string(), v.minLength(1)),
              process.env.REFERENCE_STORE_STAFF_COOKIE,
            ),
            origin,
          },
  });

const synchronizeMedia = async (origin: string) => {
  const outcomes = [] as { readonly asset: string; readonly outcome: "retained" | "uploaded" }[];
  for (const media of referenceStoreFixture.media) {
    const path = `/api/reference-store/media/${media.fileName}`;
    const bytes = await readFile(join(mediaRoot, media.fileName));
    const response = await fetch(new URL(path, origin), {
      method: "PUT",
      headers: {
        "content-type": "application/octet-stream",
        "x-reference-media-sha256": media.sha256,
        ...(seedArguments.mode === "local" ? { "x-reference-store-local-token": localToken } : {}),
        ...(seedArguments.mode === "remote"
          ? {
              cookie: v.parse(
                v.pipe(v.string(), v.minLength(1)),
                process.env.REFERENCE_STORE_STAFF_COOKIE,
              ),
              origin,
            }
          : {}),
      },
      body: Uint8Array.from(bytes).buffer,
    });
    const value = v.parse(
      v.strictObject({
        data: v.strictObject({ outcome: v.picklist(["retained", "uploaded"]) }),
      }),
      await readResponse(response, "PUT", path),
    );
    outcomes.push({ asset: media.key, outcome: value.data.outcome });
  }
  return outcomes;
};

const retryCachePurge = async (origin: string) => {
  await request(origin, "/api/catalog/groupings/cache-purge/retry", "POST");
  for (const product of referenceStoreFixture.products) {
    await request(origin, `/api/catalog/products/${product.id}/cache-purge/retry`, "POST");
  }
  for (const bundle of referenceStoreFixture.bundles) {
    await request(origin, `/api/catalog/bundles/${bundle.id}/cache-purge/retry`, "POST");
  }
  await request(origin, "/api/cms/cache-purge/retry", "POST");
};

const main = async () => {
  const worker = seedArguments.mode === "local" ? await startLocalWorker() : undefined;
  try {
    const origin = seedArguments.mode === "local" ? localOrigin : remoteOrigin();
    const media = await synchronizeMedia(origin);
    const client = createSeedClient(origin);
    const installation = requireEdenResponse(
      await client.api["reference-store"].fixture.put(referenceStoreFixture),
      "PUT",
      "/api/reference-store/fixture",
    );
    if (seedArguments.mode === "remote") {
      await retryCachePurge(origin);
    }
    const proof = requireEdenResponse(
      await client.api["reference-store"].fixture.proof.post(referenceStoreFixture),
      "POST",
      "/api/reference-store/fixture/proof",
    );
    process.stdout.write(
      `${JSON.stringify(
        {
          storeKey: referenceStoreFixture.storeKey,
          paymentProvider: referenceStoreFixture.paymentProvider,
          scenarioKeys: referenceStoreFixture.scenarioKeys,
          mode: seedArguments.mode,
          media,
          installation,
          proof,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    worker?.kill("SIGTERM");
  }
};

await main();
