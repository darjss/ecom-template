import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const authOutputs = [
  {
    config: "packages/kernel/scripts/staff-auth.config.ts",
    tracked: "packages/kernel/src/auth/staff.generated.ts",
  },
  {
    config: "packages/kernel/scripts/customer-auth.config.ts",
    tracked: "packages/kernel/src/auth/customer.generated.ts",
  },
];
const trackedMigrations = "packages/kernel/migrations";
const authWriteCommand = "pnpm auth:generate";
const migrationWriteCommand = "pnpm db:generate";

export const isFatalGeneratedOutput = (output) => /(?:^|\n)(?:Error {2}|\w*Error:)/.test(output);

const run = (args, label, temporaryRoot) => {
  const result = spawnSync("pnpm", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });
  if (result.error) {
    throw new Error(`${label} could not start: ${result.error.message}`);
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
    .replaceAll(temporaryRoot, "<temporary directory>")
    .trim();
  if (result.status !== 0 || isFatalGeneratedOutput(output)) {
    throw new Error(
      `${label} failed with exit code ${result.status}${output ? `\n${output}` : ""}`,
    );
  }
};

const listFiles = async (root, directory = root) => {
  const paths = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...(await listFiles(root, path)));
    } else if (entry.isFile()) {
      paths.push(relative(root, path));
    }
  }
  return paths.toSorted();
};

const compareFile = async (generated, tracked, command, drifts) => {
  const [generatedBytes, trackedBytes] = await Promise.all([
    readFile(generated),
    readFile(tracked),
  ]);
  if (!generatedBytes.equals(trackedBytes)) {
    drifts.push(`${tracked}: content differs; run ${command}`);
  }
};

const compareDirectories = async (generated, tracked, command, drifts) => {
  const [generatedFiles, trackedFiles] = await Promise.all([
    listFiles(generated),
    listFiles(tracked),
  ]);
  const paths = new Set([...generatedFiles, ...trackedFiles]);
  for (const path of [...paths].toSorted()) {
    const generatedExists = generatedFiles.includes(path);
    const trackedExists = trackedFiles.includes(path);
    const trackedPath = join(tracked, path);
    if (!trackedExists) {
      drifts.push(`${trackedPath}: tracked output is missing; run ${command}`);
    } else if (!generatedExists) {
      drifts.push(`${trackedPath}: tracked file is no longer generated; run ${command}`);
    } else {
      await compareFile(join(generated, path), trackedPath, command, drifts);
    }
  }
};

const temporaryRoot = await mkdtemp(join(tmpdir(), "ecom-generated-"));
try {
  const temporaryAuthOutputs = authOutputs.map(({ config, tracked }) => ({
    config,
    tracked,
    generated: join(temporaryRoot, tracked.split("/").at(-1)),
  }));

  for (const { config, generated } of temporaryAuthOutputs) {
    run(
      ["exec", "better-auth", "generate", "--config", config, "--output", generated, "--yes"],
      `Better Auth generation for ${config}`,
      temporaryRoot,
    );
  }
  run(
    ["exec", "oxfmt", ...temporaryAuthOutputs.map(({ generated }) => generated)],
    "Better Auth output formatting",
    temporaryRoot,
  );

  const temporaryMigrations = join(temporaryRoot, "migrations");
  await cp(trackedMigrations, temporaryMigrations, { recursive: true });
  run(
    [
      "exec",
      "drizzle-kit",
      "generate",
      "--dialect",
      "sqlite",
      "--schema",
      "packages/kernel/src/db/schema.ts",
      "--out",
      relative(process.cwd(), temporaryMigrations),
    ],
    "Drizzle migration generation",
    temporaryRoot,
  );

  const drifts = [];
  for (const { generated, tracked } of temporaryAuthOutputs) {
    await compareFile(generated, tracked, authWriteCommand, drifts);
  }
  await compareDirectories(temporaryMigrations, trackedMigrations, migrationWriteCommand, drifts);

  if (drifts.length > 0) {
    throw new Error(
      `Generated artifacts are stale:\n${drifts.map((drift) => `- ${drift}`).join("\n")}`,
    );
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
