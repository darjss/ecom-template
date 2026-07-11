# Portless worktree prototype

Throwaway evidence for “Prototype Portless multi-store and worktree development.” Do not merge this branch.

- Generated merchant packages expose `dev` through `portless run --name <merchant>.shop`.
- The canonical all-store command is `pnpm dev:stores`, implemented by Vite Plus workspace filtering and parallel execution.
- The canonical one-store command is `vp run @prototype-shop/<merchant>#dev`.
- Main-worktree URLs are `https://<merchant>.shop.localhost`. Linked worktrees add Portless's sanitized final branch segment: `https://<worktree>.<merchant>.shop.localhost`.
- Each app keeps Cloudflare local state under its own `.wrangler/state/v3`; another worktree has another checkout path, so D1, KV, and R2 are isolated by `(worktree, merchant)` without generated resource names.
- Browser proof is serialized across all worktrees. A worker must invoke browser commands through `prototypes/portless-worktree/with-browser-lease.sh agent-browser ...`; the shared Git common-directory lock rejects a second browser worker instead of competing for terminal and browser resources.
- Implementation workers start and inspect their own app processes, but only one designated proof worker may hold the browser lease. Browser proof starts after servers report ready and ends by closing its named browser session.

The page writes one value to real local D1, KV, and R2 bindings and sets a host-only secure cookie. It renders the observed request origin and corresponding Better Auth Google callback URL.
