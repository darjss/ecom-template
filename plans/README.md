# Agent experience implementation plans

Written against `f748ab739274ed57e57e115c081a3c68bc249733`.

These plans implement the first-tier agent experience improvements selected after the bootstrap merge. Execute them in order because the documentation plans establish authority before the executable tooling is tightened.

| Order | Plan                                                                       | Status | Depends on |
| ----- | -------------------------------------------------------------------------- | ------ | ---------- |
| 1     | [001-contract-authority.md](001-contract-authority.md)                     | ready  | none       |
| 2     | [002-architecture-guardrails.md](002-architecture-guardrails.md)           | ready  | 001        |
| 3     | [003-feature-slice-guide.md](003-feature-slice-guide.md)                   | ready  | 001        |
| 4     | [004-non-mutating-generated-check.md](004-non-mutating-generated-check.md) | ready  | 002        |

Required final proof uses plain `pnpm`: frozen install, format check, independent TypeScript/JavaScript and Astro lint, TypeScript 7, Astro check, Knip, Sherif, dependency/architecture checks, non-mutating generated drift, production build, and clean git status. Do not add unit/integration tests, mocks, stubs, fake providers, Effect, a new task runner, or a competing validation/result stack.
