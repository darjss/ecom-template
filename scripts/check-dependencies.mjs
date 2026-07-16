import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

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

const packageNames = await readdir("packages");
const expectedNames = Object.keys(allowed);
if (packageNames.toSorted().join() !== expectedNames.toSorted().join()) {
  throw new Error(`Expected exactly nine packages: ${expectedNames.join(", ")}`);
}

for (const packageName of packageNames) {
  const manifest = JSON.parse(
    await readFile(join("packages", packageName, "package.json"), "utf8"),
  );
  const internalDependencies = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  }).filter((dependency) => dependency.startsWith("@ecom/"));
  for (const dependency of internalDependencies) {
    const dependencyName = dependency.slice("@ecom/".length);
    if (!allowed[packageName].has(dependencyName)) {
      throw new Error(`${packageName} cannot depend on ${dependencyName}`);
    }
  }
}

const sourceRoots = ["apps", "packages"];
for (const sourceRoot of sourceRoots) {
  const files = await readdir(sourceRoot, { recursive: true, withFileTypes: true });
  for (const file of files) {
    if (!file.isFile() || !/\.(?:astro|ts|tsx)$/.test(file.name)) {
      continue;
    }
    const path = join(file.parentPath, file.name);
    const source = await readFile(path, "utf8");
    if (/from\s+["']@ecom\/[^"']+\/src\//.test(source)) {
      throw new Error(`Private package source import in ${path}`);
    }
    if (sourceRoot === "apps" && source.includes("@ecom/delivery")) {
      throw new Error(`Node-only delivery imported by Worker app in ${path}`);
    }
  }
}
