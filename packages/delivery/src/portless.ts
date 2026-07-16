import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import * as v from "valibot";
import { StoreSlugSchema } from "./index";

const execFileOutput = promisify(execFile);
const PortlessOriginSchema = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => new URL(value).hostname.endsWith(".localhost")),
);
const WorkerIdentitySchema = v.pipe(v.string(), v.trim(), v.minLength(1));
const HostnameLabelSchema = v.pipe(v.string(), v.regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/));

const sanitizeHostnameLabel = (source: string) => {
  const sanitized = source
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]/g, "-")
    .replaceAll(/-{2,}/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  if (sanitized.length <= 63) {
    return v.parse(HostnameLabelSchema, sanitized);
  }
  const hash = createHash("sha256").update(sanitized).digest("hex").slice(0, 6);
  return v.parse(HostnameLabelSchema, `${sanitized.slice(0, 56).replaceAll(/-+$/g, "")}-${hash}`);
};

const readWorktreeIdentity = async () => {
  const orchIdentity = v.safeParse(WorkerIdentitySchema, process.env.ORCH_WORKER_ID);
  if (orchIdentity.success) {
    return sanitizeHostnameLabel(orchIdentity.output);
  }
  const [{ stdout: branchSource }, { stdout: worktreeSource }] = await Promise.all([
    execFileOutput("git", ["symbolic-ref", "--short", "HEAD"]),
    execFileOutput("git", ["worktree", "list", "--porcelain"]),
  ]);
  const branch = branchSource.trim();
  const worktreeCount = worktreeSource
    .split("\n")
    .filter((line) => line.startsWith("worktree ")).length;
  if (worktreeCount <= 1 || branch === "main" || branch === "master") {
    return undefined;
  }
  return sanitizeHostnameLabel(branch.split("/").at(-1) ?? "");
};

export const readCommitIdentity = async () => {
  const { stdout } = await execFileOutput("git", ["rev-parse", "HEAD"]);
  return v.parse(v.pipe(v.string(), v.regex(/^[0-9a-f]{40}$/)), stdout.trim());
};

export const resolveLocalStore = async (input: string) => {
  const slug = v.parse(StoreSlugSchema, input);
  const identity = await readWorktreeIdentity();
  const name = identity ? `${identity}.${slug}.shop` : `${slug}.shop`;
  const { stdout } = await execFileOutput("portless", ["get", name, "--no-worktree"]);
  const origin = v.parse(PortlessOriginSchema, stdout.trim());
  return { slug, name, origin };
};
