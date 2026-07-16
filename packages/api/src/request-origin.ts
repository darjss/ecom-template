import { env } from "cloudflare:workers";
import * as v from "valibot";

const OriginSchema = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && url.port === "" && url.pathname === "/";
  }),
);

export const resolveStoreRequestOrigin = (request: Request, storeSlug: string) => {
  const canonicalOrigin = v.safeParse(OriginSchema, env.PUBLIC_STORE_ORIGIN);
  if (!canonicalOrigin.success) {
    return undefined;
  }

  const requestUrl = new URL(request.url);
  const canonicalUrl = new URL(canonicalOrigin.output);
  if (requestUrl.port !== "") {
    return undefined;
  }
  if (requestUrl.hostname === canonicalUrl.hostname) {
    return canonicalUrl.origin;
  }

  const localHostname = `${storeSlug}.shop.localhost`;
  if (requestUrl.hostname === localHostname) {
    return `https://${localHostname}`;
  }

  const worktreeSuffix = `.${localHostname}`;
  if (!requestUrl.hostname.endsWith(worktreeSuffix)) {
    return undefined;
  }

  const worktreePrefix = requestUrl.hostname.slice(0, -worktreeSuffix.length);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(worktreePrefix)
    ? `https://${requestUrl.hostname}`
    : undefined;
};
