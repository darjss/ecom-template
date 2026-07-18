import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { parse as parseJsonc, type ParseError } from "jsonc-parser";
import * as v from "valibot";
import { D1DatabaseIdSchema, D1DatabaseNameSchema } from "./index";

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

export const readAppResources = async (slug: string) => {
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

export const readAppD1Resource = async (slug: string) => (await readAppResources(slug)).d1;

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

export const withWranglerWorker = async <T>(
  commandArgs: string[],
  redactedValues: readonly string[],
  operation: (endpoint: string) => Promise<T>,
) => {
  const port = await selectAvailablePort();
  const endpoint = `http://127.0.0.1:${port}`;
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
    let ready = false;
    while (Date.now() < deadline && !ready) {
      if (child.exitCode !== null) {
        throw new Error(sanitizedError() || "Local Worker failed to start");
      }
      try {
        await fetch(endpoint, { method: "HEAD", signal: AbortSignal.timeout(2_000) });
        ready = true;
      } catch {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
      }
    }
    if (!ready) {
      throw new Error(sanitizedError() || "Local Worker did not become ready");
    }
    return await operation(endpoint);
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
