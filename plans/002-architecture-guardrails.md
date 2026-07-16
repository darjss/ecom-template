# Make architecture ownership executable

Base: `f748ab739274ed57e57e115c081a3c68bc249733`

## Why

`AGENTS.md` contains strong architecture rules, while `scripts/check-dependencies.mjs` currently enforces only the nine package names, package dependency edges, private `/src/` imports, and the Worker-to-delivery prohibition. Agents need immediate deterministic failures for the highest-risk ownership violations.

## Scope

Deepen the existing dependency checker rather than adding a framework or dependency. Keep one script and explicit allowlists.

Add checks for tracked TypeScript/Astro sources that enforce:

- `better-result` imports exist only under `packages/kernel` and `packages/integrations`.
- `drizzle-orm` and kernel raw schema imports remain under `packages/kernel`; direct `../db/schema` or equivalent raw-schema imports inside kernel are allowed only in `src/db`, generated auth files, and feature `persistence.ts` modules.
- `cloudflare:workers` imports are limited to the Store Worker and owning server modules in `packages/api` and `packages/kernel`; browser packages (`client`, `admin`, `storefront`, `ui`, `contracts`) cannot import it.
- package manifests expose explicit entrypoints and no package exports a private `src/*` wildcard.
- app workspace dependencies stay on approved composition packages and never include Node-only `@ecom/delivery` or private kernel internals.
- forbidden removed-stack imports or dependencies (`react`, Lucide, Polar, TypeBox, Cuid2) fail with the exact file or manifest path.

Use path and import parsing no broader than necessary. Regex is acceptable for import specifiers because the existing script already uses it; avoid building a general JavaScript parser. Error messages must tell agents the violated owner and accepted location.

Update command naming only if it improves truthfulness without breaking `pnpm deps:check`; CI must still run the gate as a separate named step.

## Boundaries

Do not enforce stylistic preferences already owned by Oxlint. Do not ban dependencies merely because they are currently unused. Do not encode future provider package names before they exist. Do not create a registry, dependency-injection layer, or generated graph.

## Verification

- `pnpm deps:check` passes on the current workspace.
- Run focused temporary mutation probes outside tracked source, or copy the checker to a disposable directory, to prove each new rule can fail with a useful message. Do not commit fixtures or tests.
- Full `pnpm check` and `git diff --check` pass.

## Stop conditions

If a proposed rule rejects a currently accepted source location, reconcile it against `AGENTS.md` and the contract index rather than adding a broad ignore.
