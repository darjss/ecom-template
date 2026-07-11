import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { adminCapabilities } from "@prototype/commerce-kernel/admin";
import { commerceCachePolicy } from "@prototype/commerce-kernel/cache";
import { commerceSchema } from "@prototype/commerce-kernel/schema";
import {
  createProvisioningState,
  nextProvisioningStep,
  recordProvisioningFailure,
  recordProvisioningSuccess,
} from "@prototype/commerce-kernel/provision";
import { storeProfile } from "./store-profile.mjs";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = resolve(sourceDirectory, "..");
const prototypeRoot = resolve(appDirectory, "../..");
const generatedDirectory = resolve(appDirectory, ".generated");
const statePath = resolve(generatedDirectory, "provision-state.json");
const configPath = resolve(generatedDirectory, "wrangler.jsonc");
const typesPath = resolve(generatedDirectory, "worker-configuration.d.ts");
const migrationDirectory = resolve(prototypeRoot, commerceSchema.migrationsDirectory);
const seedPath = resolve(sourceDirectory, "seed.sql");
const workerPath = resolve(sourceDirectory, "worker.mjs");
const terminal = createInterface({ input: process.stdin, output: process.stdout });

mkdirSync(generatedDirectory, { recursive: true });

const execute = (command, args, print = true) => {
  const output = execFileSync(command, args, { cwd: prototypeRoot, encoding: "utf8", stdio: ["inherit", "pipe", "pipe"] });
  if (print) process.stdout.write(output);
  return output;
};

const run = (args) => execute("wrangler", args);
const runJson = (args) => JSON.parse(execute("wrangler", args, false));

const loadState = () => {
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    const suffix = Date.now().toString(36).slice(-6);
    return createProvisioningState({ profile: storeProfile, suffix });
  }
};

const saveState = (state) => writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

const writeConfig = (state) => {
  const config = {
    name: state.resources.worker.name,
    main: workerPath,
    compatibility_date: "2026-07-11",
    observability: { enabled: true },
    cache: { enabled: true },
    d1_databases: [{ binding: "DB", database_name: state.resources.d1.name, database_id: state.resources.d1.id, migrations_dir: migrationDirectory }],
    kv_namespaces: [
      { binding: "SESSIONS", id: state.resources.sessionsKv.id },
      { binding: "CACHE", id: state.resources.cacheKv.id },
    ],
    r2_buckets: [{ binding: "MEDIA", bucket_name: state.resources.r2.name }],
    vars: { STORE_SLUG: storeProfile.slug },
  };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return { config: { path: configPath } };
};

const executeStep = (state, step) => {
  if (step === "create-d1") {
    run(["d1", "create", state.resources.d1.name, "--location", storeProfile.provisioning.region]);
    const database = runJson(["d1", "list", "--json"]).find(({ name }) => name === state.resources.d1.name);
    if (!database) throw new Error("Created D1 database was not found");
    return { d1: { ...state.resources.d1, id: database.uuid } };
  }
  if (step === "create-sessions-kv" || step === "create-cache-kv") {
    const resourceKey = step === "create-sessions-kv" ? "sessionsKv" : "cacheKv";
    run(["kv", "namespace", "create", state.resources[resourceKey].name]);
    const namespace = runJson(["kv", "namespace", "list"]).find(({ title }) => title === state.resources[resourceKey].name);
    if (!namespace) throw new Error(`Created KV namespace ${state.resources[resourceKey].name} was not found`);
    return { [resourceKey]: { ...state.resources[resourceKey], id: namespace.id } };
  }
  if (step === "create-r2") {
    run(["r2", "bucket", "create", state.resources.r2.name, "--location", storeProfile.provisioning.region]);
    return { r2: { ...state.resources.r2, created: true } };
  }
  if (step === "write-config") return writeConfig(state);
  if (step === "generate-types") {
    run(["types", typesPath, "--config", configPath]);
    return { generatedTypes: { path: typesPath } };
  }
  if (step === "migrate") {
    run(["d1", "migrations", "apply", "DB", "--remote", "--config", configPath]);
    return { migration: { version: commerceSchema.version } };
  }
  if (step === "seed") {
    run(["d1", "execute", "DB", "--remote", "--file", seedPath, "--yes", "--config", configPath]);
    return { seed: { productId: "prototype-product" } };
  }
  if (step === "deploy") {
    const output = run(["deploy", "--config", configPath]);
    const url = output.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0];
    if (!url) throw new Error("Deployment succeeded but no workers.dev URL was found");
    return { worker: { ...state.resources.worker, url } };
  }
  if (step === "prove") {
    const response = JSON.parse(execute("curl", ["--fail", "--silent", "--show-error", `${state.resources.worker.url}/api/health`]));
    if (response.product?.id !== "prototype-product") throw new Error("Live proof did not return the seeded product");
    return { proof: { url: `${state.resources.worker.url}/api/health`, response } };
  }
  throw new Error(`Unknown provisioning step: ${step}`);
};

const runNext = (state) => {
  const step = nextProvisioningStep(state);
  if (!step) return state;
  try {
    const nextState = recordProvisioningSuccess(state, step, executeStep(state, step));
    saveState(nextState);
    return nextState;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedState = recordProvisioningFailure(state, step, message);
    saveState(failedState);
    return failedState;
  }
};

const cleanup = async (state) => {
  const confirmation = await terminal.question(`Type ${state.baseName} to delete every prototype resource: `);
  if (confirmation !== state.baseName) return state;
  if (state.completed.includes("deploy")) run(["delete", state.resources.worker.name, "--force"]);
  if (state.resources.r2.created) run(["r2", "bucket", "delete", state.resources.r2.name]);
  if (state.resources.cacheKv.id) run(["kv", "namespace", "delete", "--namespace-id", state.resources.cacheKv.id, "--skip-confirmation"]);
  if (state.resources.sessionsKv.id) run(["kv", "namespace", "delete", "--namespace-id", state.resources.sessionsKv.id, "--skip-confirmation"]);
  if (state.resources.d1.id) run(["d1", "delete", state.resources.d1.name, "--skip-confirmation"]);
  const cleanedState = { ...state, status: "cleaned", cleanedAt: new Date().toISOString() };
  saveState(cleanedState);
  return cleanedState;
};

const render = (state) => {
  console.clear();
  console.log("\u001b[1mPROTOTYPE — shared-kernel multi-app contract\u001b[0m");
  console.log(`\u001b[2m${statePath}\u001b[0m\n`);
  console.log(JSON.stringify({
    packageOwnership: {
      app: ["Store Profile", "custom storefront", "Wrangler identity"],
      sharedKernel: ["commerce API", "schema/migrations", "admin", "cache policy", "provisioning machine"],
    },
    storeProfile,
    sharedImports: { adminCapabilities, commerceSchema, commerceCachePolicy },
    provisioning: state,
    nextStep: nextProvisioningStep(state) ?? "none",
  }, null, 2));
  console.log("\n\u001b[1m[n]\u001b[0m next step  \u001b[1m[a]\u001b[0m run until blocked  \u001b[1m[c]\u001b[0m cleanup  \u001b[1m[q]\u001b[0m quit");
};

let state = loadState();
saveState(state);

if (process.argv.includes("--all")) {
  if (state.status === "blocked") state = { ...state, status: "provisioning" };
  while (nextProvisioningStep(state) && state.status !== "blocked") state = runNext(state);
  render(state);
  terminal.close();
} else {
  let active = true;
  while (active) {
    render(state);
    const action = (await terminal.question("> ").catch(() => "q")).trim().toLowerCase();
    if (action === "n") state = runNext(state);
    if (action === "a") {
      if (state.status === "blocked") state = { ...state, status: "provisioning" };
      while (nextProvisioningStep(state) && state.status !== "blocked") state = runNext(state);
    }
    if (action === "c") state = await cleanup(state);
    if (action === "q") active = false;
  }
  terminal.close();
}
