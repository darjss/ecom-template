# Make generated drift checks non-mutating

Base: `f748ab739274ed57e57e115c081a3c68bc249733`

## Why

The current `generated:check` runs the write commands for Better Auth and Drizzle in the tracked tree before diffing. A verification command can therefore dirty an agent worktree on failure and obscure whether the agent intentionally generated a schema change.

## Scope

Separate intentional writes from drift verification:

- Keep or rename explicit write commands so schema authors can intentionally regenerate Staff/Customer Better Auth files and Drizzle migrations.
- Replace `generated:check` with a small Node/TypeScript script under `scripts/` that uses a temporary directory and always cleans it in `finally`.
- Generate Staff and Customer Better Auth outputs into temporary files, format those temporary files with the repository formatter, and compare bytes with the tracked generated files.
- Copy the tracked kernel migration directory into the temporary directory, run `drizzle-kit generate` against the real schema with `--out` pointing to the copy, and recursively compare it with the tracked migration directory. This preserves journal/snapshot context while detecting newly required migrations without writing tracked files.
- Report concise path-specific drift errors and tell agents which explicit write command to run.
- Preserve `pnpm generated:check` as the CI/public command and keep plain `pnpm` throughout.

Use only Node built-ins and existing workspace binaries. Validate child-process exit codes. Temporary paths must not be printed with secrets and must be removed on success or failure.

## Boundaries

Do not use git stash/reset/checkout, do not copy the whole repository, do not add a test framework, do not weaken generated drift, and do not make `generated:check` depend on a clean working tree. Intentional unrelated changes elsewhere must not fail the generated comparison.

## Verification

- Record `git status --porcelain` before and after `pnpm generated:check`; outputs must be identical.
- `pnpm generated:check` passes on the current tree.
- In a disposable worktree, alter one generated auth file and verify a focused drift message; restore it. Alter the schema without creating a migration and verify migration drift; restore it. Do not commit these probes.
- `pnpm auth:generate` and `pnpm db:generate` remain the intentional write paths.
- Full frozen install, format, lint, TypeScript 7, Astro, Knip, Sherif, architecture check, generated check, and build pass.

## Stop conditions

If Drizzle output is nondeterministic even after seeding it with a copied migration directory, stop and report the exact nondeterminism instead of normalizing away meaningful differences.
