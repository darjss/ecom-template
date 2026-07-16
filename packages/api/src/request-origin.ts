import { env } from "cloudflare:workers";
import * as v from "valibot";

const OriginSchema = v.pipe(v.string(), v.url());
const LocalPort = "1355";

export const resolveStoreRequestOrigin = (request: Request, storeSlug: string) => {
  const canonicalOrigin = v.safeParse(OriginSchema, env.PUBLIC_STORE_ORIGIN);
  if (!canonicalOrigin.success) {
    return undefined;
  }

  const requestUrl = new URL(request.url);
  const canonicalUrl = new URL(canonicalOrigin.output);
  if (requestUrl.origin === canonicalUrl.origin) {
    return requestUrl.origin;
  }

  if (requestUrl.protocol !== "https:" || requestUrl.port !== LocalPort) {
    return undefined;
  }

  const localHostname = `${storeSlug}.shop.localhost`;
  if (requestUrl.hostname === localHostname) {
    return requestUrl.origin;
  }

  const worktreeSuffix = `.${localHostname}`;
  if (!requestUrl.hostname.endsWith(worktreeSuffix)) {
    return undefined;
  }

  const worktreePrefix = requestUrl.hostname.slice(0, -worktreeSuffix.length);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(worktreePrefix) ? requestUrl.origin : undefined;
};
