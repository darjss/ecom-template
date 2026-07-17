import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const allowed = {
  contracts: new Set(),
  kernel: new Set(["contracts"]),
  api: new Set(["contracts", "kernel"]),
  client: new Set(["contracts", "api"]),
  admin: new Set(["client", "contracts", "ui"]),
  storefront: new Set(["client", "contracts", "ui"]),
  ui: new Set(),
  integrations: new Set(["contracts"]),
  delivery: new Set(),
};

const appCompositionPackages = new Set(["admin", "api", "integrations", "storefront", "ui"]);
const browserPackages = new Set(["admin", "client", "contracts", "storefront", "ui"]);
const forbiddenPackages = new Map([
  ["react", "React"],
  ["react-dom", "React"],
  ["lucide", "Lucide"],
  ["lucide-react", "Lucide"],
  ["lucide-solid", "Lucide"],
  ["@polar-sh", "Polar"],
  ["@sinclair/typebox", "TypeBox"],
  ["typebox", "TypeBox"],
  ["@paralleldrive/cuid2", "Cuid2"],
  ["cuid2", "Cuid2"],
]);
const manifestDependencyFields = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
const rawSchemaPath = resolve("packages/kernel/src/db/schema");

const fail = (message) => {
  throw new Error(message);
};

const packageOwner = (path) => {
  const match = /^packages\/([^/]+)\//.exec(path);
  return match?.[1];
};

const dependencyEntries = (manifest) =>
  manifestDependencyFields.flatMap((field) =>
    Object.keys(manifest[field] ?? {}).map((dependency) => [field, dependency]),
  );

const forbiddenStack = (specifier) => {
  for (const [dependency, stack] of forbiddenPackages) {
    if (specifier === dependency || specifier.startsWith(`${dependency}/`)) {
      return stack;
    }
  }
};

const readManifest = async (path) => JSON.parse(await readFile(path, "utf8"));

const checkExportTarget = (manifestPath, key, target) => {
  if (typeof target === "string") {
    if (target.includes("*")) {
      fail(`${manifestPath}: export ${key} target ${target} contains a forbidden wildcard`);
    }
    return;
  }
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    fail(`${manifestPath}: export ${key} must target a string or explicit conditional object`);
  }
  const conditions = Object.entries(target);
  if (conditions.length === 0) {
    fail(`${manifestPath}: export ${key} has an empty conditional object`);
  }
  for (const [condition, conditionTarget] of conditions) {
    if (condition.includes("*")) {
      fail(`${manifestPath}: export ${key} condition ${condition} contains a forbidden wildcard`);
    }
    checkExportTarget(manifestPath, `${key} condition ${condition}`, conditionTarget);
  }
};

const checkRemovedDependencies = (path, manifest) => {
  for (const [field, dependency] of dependencyEntries(manifest)) {
    const stack = forbiddenStack(dependency);
    if (stack) {
      fail(`${path}: removed ${stack} stack dependency ${dependency} is forbidden in ${field}`);
    }
  }
};

const packageNames = await readdir("packages");
const expectedNames = Object.keys(allowed);
if (packageNames.toSorted().join() !== expectedNames.toSorted().join()) {
  fail(`Expected exactly nine packages: ${expectedNames.join(", ")}`);
}

checkRemovedDependencies("package.json", await readManifest("package.json"));

for (const packageName of packageNames) {
  const manifestPath = join("packages", packageName, "package.json");
  const manifest = await readManifest(manifestPath);
  checkRemovedDependencies(manifestPath, manifest);

  const internalDependencies = dependencyEntries(manifest)
    .map(([, dependency]) => dependency)
    .filter((dependency) => dependency.startsWith("@ecom/"));
  for (const dependency of internalDependencies) {
    const dependencyName = dependency.slice("@ecom/".length);
    if (!allowed[packageName].has(dependencyName)) {
      fail(
        `${manifestPath}: @ecom/${packageName} cannot depend on ${dependency}; accepted owners: ${[...allowed[packageName]].map((name) => `@ecom/${name}`).join(", ") || "none"}`,
      );
    }
  }

  let hasSource = true;
  try {
    await access(join("packages", packageName, "src"));
  } catch {
    hasSource = false;
  }
  if (
    hasSource &&
    (!manifest.exports || typeof manifest.exports !== "object" || Array.isArray(manifest.exports))
  ) {
    fail(`${manifestPath}: source package must expose explicit exports`);
  }
  for (const [entrypoint, target] of Object.entries(manifest.exports ?? {})) {
    if (entrypoint.includes("*")) {
      fail(`${manifestPath}: export key ${entrypoint} contains a forbidden wildcard`);
    }
    checkExportTarget(manifestPath, entrypoint, target);
  }
}

const appEntries = await readdir("apps", { withFileTypes: true });
for (const appEntry of appEntries) {
  if (!appEntry.isDirectory()) {
    continue;
  }
  const manifestPath = join("apps", appEntry.name, "package.json");
  const manifest = await readManifest(manifestPath);
  checkRemovedDependencies(manifestPath, manifest);
  for (const [, dependency] of dependencyEntries(manifest)) {
    if (!dependency.startsWith("@ecom/")) {
      continue;
    }
    const dependencyName = dependency.slice("@ecom/".length);
    if (!appCompositionPackages.has(dependencyName)) {
      fail(
        `${manifestPath}: Store apps may depend only on composition packages ${[...appCompositionPackages].map((name) => `@ecom/${name}`).join(", ")}; found ${dependency}`,
      );
    }
  }
}

const importSpecifiers = (source) =>
  [...source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g)].map(
    (match) => match[1],
  );

const importsRawKernelSchema = (path, specifier) => {
  if (specifier === "@ecom/kernel/src/db/schema") {
    return true;
  }
  if (!specifier.startsWith(".")) {
    return false;
  }
  return resolve(dirname(path), specifier).replace(/\.(?:js|ts)$/, "") === rawSchemaPath;
};

const rawSchemaLocationAllowed = (path) =>
  path.startsWith("packages/kernel/src/db/") ||
  /^packages\/kernel\/src\/auth\/[^/]+\.generated\.ts$/.test(path) ||
  /^packages\/kernel\/src\/[^/]+\/persistence\.ts$/.test(path) ||
  path === "packages/kernel/src/catalog/read/persistence.ts";

const cloudflareLocationAllowed = (path) =>
  /^apps\/[^/]+\/src\/worker\.ts$/.test(path) ||
  path.startsWith("packages/api/src/") ||
  path.startsWith("packages/integrations/src/") ||
  path.startsWith("packages/kernel/src/");

for (const sourceRoot of ["apps", "packages"]) {
  const files = await readdir(sourceRoot, { recursive: true, withFileTypes: true });
  for (const file of files) {
    if (!file.isFile() || !/\.(?:astro|ts|tsx)$/.test(file.name)) {
      continue;
    }
    const path = join(file.parentPath, file.name);
    const owner = packageOwner(path);
    const source = await readFile(path, "utf8");
    for (const specifier of importSpecifiers(source)) {
      if (/^@ecom\/[^/]+\/src\//.test(specifier)) {
        fail(
          `${path}: private package source import ${specifier} is forbidden; use the owning package's public entrypoint`,
        );
      }
      if (sourceRoot === "apps" && specifier === "@ecom/delivery") {
        fail(`${path}: Node-only @ecom/delivery cannot be imported by a Store Worker app`);
      }
      const stack = forbiddenStack(specifier);
      if (stack) {
        fail(`${path}: removed ${stack} stack import ${specifier} is forbidden`);
      }
      if (
        (specifier === "better-result" || specifier.startsWith("better-result/")) &&
        owner !== "kernel" &&
        owner !== "integrations"
      ) {
        fail(`${path}: better-result is owned only by packages/kernel and packages/integrations`);
      }
      if (
        (specifier === "drizzle-orm" || specifier.startsWith("drizzle-orm/")) &&
        owner !== "kernel"
      ) {
        fail(`${path}: drizzle-orm is owned only by packages/kernel`);
      }
      if (importsRawKernelSchema(path, specifier) && !rawSchemaLocationAllowed(path)) {
        fail(
          `${path}: raw kernel schema imports belong only in packages/kernel/src/db, generated auth files, or feature persistence.ts modules`,
        );
      }
      if (specifier === "cloudflare:workers" && !cloudflareLocationAllowed(path)) {
        const detail =
          owner && browserPackages.has(owner)
            ? `browser package @ecom/${owner} cannot import Worker bindings`
            : "Worker bindings belong only in a Store src/worker.ts or owning API, integration, and kernel server modules";
        fail(`${path}: ${detail}`);
      }
    }
  }
}
