# Portless worktree prototype

Throwaway evidence for “Prototype Portless multi-store and worktree development.” Do not merge this branch.

- Generated merchant packages expose `dev` through `portless run --name <merchant>.shop`.
- The canonical all-store command is `pnpm dev:stores`. It first ensures the shared HTTPS proxy is available on standard port `443`, then uses Vite Plus workspace filtering and parallel execution. On Linux and macOS, Portless prompts for `sudo` only when starting the privileged proxy; store processes continue as the normal user.
- The canonical one-store command is `pnpm dev:proxy && vp run @prototype-shop/<merchant>#dev`.
- Main-worktree URLs are `https://<merchant>.shop.localhost`. Linked worktrees add Portless's sanitized final branch segment: `https://<worktree>.<merchant>.shop.localhost`.
- `portless trust` is an optional one-time human setup that removes local CA warnings; agents can use a browser configured to trust or ignore this development-only CA.
- Each app keeps Cloudflare local state under its own `.wrangler/state/v3`; another worktree has another checkout path, so D1, KV, and R2 are isolated by `(worktree, merchant)` without generated resource names.
- Browser proof is serialized across all worktrees. A worker must invoke browser commands through `prototypes/portless-worktree/with-browser-lease.sh agent-browser ...`; the shared Git common-directory lock rejects a second browser worker instead of competing for terminal and browser resources.
- Implementation workers start and inspect their own app processes, but only one designated proof worker may hold the browser lease. Browser proof starts after servers report ready and ends by closing its named browser session.

The page writes one value to real local D1, KV, and R2 bindings and sets a host-only secure cookie. It renders the observed request origin and corresponding Better Auth Google callback URL.

## Accepted auth contract

- Better Auth resolves its base URL from the validated request host. Each generated app allows only its production hosts, `<merchant>.shop.localhost`, and `*.<merchant>.shop.localhost`; unknown hosts fail rather than falling back.
- Cross-subdomain cookies stay disabled. Better Auth and application cookies remain host-only, so merchants and worktrees cannot read one another's sessions.
- Google OAuth is enabled by default only for the canonical checkout URL, whose exact `https://<merchant>.shop.localhost/api/auth/callback/google` callback is registered with Google.
- Linked worktrees use non-Google authentication by default. Testing Google from a worktree requires deliberately enabling its credentials and temporarily registering that worktree's exact rendered callback URL. No wildcard callback or shared OAuth-proxy service is part of v1.
