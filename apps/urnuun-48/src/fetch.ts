import { handle } from "@astrojs/cloudflare/handler";
import {
  isPublicMediaPath,
  MediaUploadMultipartMaxBytes,
  resolveStaffRequest,
  resolveStoreRequestOrigin,
  servePublicMedia,
} from "@ecom/api";
import { isPublicCacheTagHeader } from "@ecom/storefront/cache";
import { api } from "./api";
import { storeDefinition } from "./profile/definition";

const publicStorefrontPaths = new Set(["/", "/story", "/locations"]);
const previewSearchParameters = new Set(["preview", "draft"]);
const publicCatalogPath =
  /^\/(?:products|bundles|categories|collections)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const publicCmsPath =
  /^\/(?:locations\/location_[0-7][0123456789abcdefghjkmnpqrstvwxyz]{25}|policies\/(?:terms|privacy|delivery|returns_refunds|payment))$/;
const privateCatalogImageUploadPath =
  /^\/api\/catalog\/items\/(?:product|bundle)_[0-7][0123456789abcdefghjkmnpqrstvwxyz]{25}\/images$/;
const isPublicStorefrontPath = (pathname: string) =>
  publicStorefrontPaths.has(pathname) ||
  publicCatalogPath.test(pathname) ||
  publicCmsPath.test(pathname);

const responseWithHeaders = (request: Request, response: Response, headers: Headers) =>
  new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

const privateResponse = (request: Request, response: Response) => {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-store");
  headers.delete("cloudflare-cdn-cache-control");
  headers.delete("cache-tag");
  return responseWithHeaders(request, response, headers);
};

const classifyResponse = (request: Request, response: Response) => {
  const requestUrl = new URL(request.url);
  const cacheTags = response.headers.get("cache-tag");
  const retainsPublicPolicy =
    (request.method === "GET" || request.method === "HEAD") &&
    response.status === 200 &&
    isPublicStorefrontPath(requestUrl.pathname) &&
    requestUrl.search === "" &&
    !request.headers.has("authorization") &&
    !request.headers.has("cookie") &&
    !response.headers.has("set-cookie") &&
    response.headers.get("content-type")?.startsWith("text/html") === true &&
    response.headers.get("cache-control") === "public, max-age=0, must-revalidate" &&
    response.headers.get("cloudflare-cdn-cache-control") === "public, max-age=1209600" &&
    cacheTags !== null &&
    isPublicCacheTagHeader(cacheTags);
  return retainsPublicPolicy
    ? responseWithHeaders(request, response, new Headers(response.headers))
    : privateResponse(request, response);
};

const canonicalRedirect = (request: Request, origin: string) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return undefined;
  }
  const url = new URL(request.url);
  const withoutTrailingSlash = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";
  const canonicalPath = isPublicStorefrontPath(withoutTrailingSlash) ? withoutTrailingSlash : null;
  if (
    canonicalPath === null ||
    [...url.searchParams.keys()].some((key) => previewSearchParameters.has(key))
  ) {
    return undefined;
  }
  const canonicalUrl = new URL(canonicalPath, origin);
  if (url.toString() === canonicalUrl.toString()) {
    return undefined;
  }
  return new Response(null, {
    status: 308,
    headers: { location: canonicalUrl.toString(), "cache-control": "private, no-store" },
  });
};

const rejectedHostResponse = () =>
  Response.json(
    { error: { code: "validation", message: "Request host is not accepted" } },
    { status: 421, headers: { "cache-control": "private, no-store" } },
  );

const rejectedMediaUploadSizeResponse = () =>
  Response.json(
    {
      error: {
        code: "validation",
        message: `Multipart image uploads must declare no more than ${MediaUploadMultipartMaxBytes} bytes`,
      },
    },
    { status: 413, headers: { "cache-control": "private, no-store" } },
  );

const acceptsMediaUploadSize = (request: Request) => {
  const contentLength = request.headers.get("content-length");
  return (
    contentLength !== null &&
    /^\d+$/.test(contentLength) &&
    BigInt(contentLength) <= BigInt(MediaUploadMultipartMaxBytes)
  );
};

const dispatchStoreRequest = async (
  request: Request,
  environment: Env,
  context: ExecutionContext,
) => {
  const origin = resolveStoreRequestOrigin(request, storeDefinition.profile.slug);
  if (!origin) {
    return rejectedHostResponse();
  }

  const pathname = new URL(request.url).pathname;
  if (isPublicMediaPath(pathname)) {
    return privateResponse(request, await servePublicMedia(request));
  }
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    if (
      request.method === "POST" &&
      privateCatalogImageUploadPath.test(pathname) &&
      !acceptsMediaUploadSize(request)
    ) {
      return rejectedMediaUploadSizeResponse();
    }
    return privateResponse(request, await api.fetch(request));
  }
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    try {
      const staff = await resolveStaffRequest(request, {
        profile: storeDefinition.profile,
        providers: storeDefinition.providers,
      });
      if (staff.kind === "unavailable") {
        return privateResponse(
          request,
          Response.json(
            { error: { code: "unavailable", message: "Staff authorization is unavailable" } },
            { status: 503 },
          ),
        );
      }
      if (staff.kind !== "active") {
        return new Response(null, {
          status: 303,
          headers: {
            location: "/admin/login",
            "cache-control": "private, no-store",
          },
        });
      }
    } catch {
      return privateResponse(
        request,
        Response.json(
          { error: { code: "unavailable", message: "Staff authorization is unavailable" } },
          { status: 503 },
        ),
      );
    }
  }
  return classifyResponse(request, await handle(request, environment, context));
};

const isAnonymousCacheCandidate = (request: Request) => {
  const url = new URL(request.url);
  return (
    (request.method === "GET" || request.method === "HEAD") &&
    (isPublicStorefrontPath(url.pathname) || isPublicMediaPath(url.pathname)) &&
    url.search === "" &&
    !request.headers.has("authorization") &&
    !request.headers.has("cookie")
  );
};

export const dispatchStoreEntrypointRequest = (
  request: Request,
  environment: Env,
  context: ExecutionContext,
  mode: "cache" | "mutation",
) =>
  mode === "cache" && isPublicMediaPath(new URL(request.url).pathname)
    ? servePublicMedia(request)
    : dispatchStoreRequest(request, environment, context);

const isCacheMutationRequest = (request: Request) => {
  const pathname = new URL(request.url).pathname;
  return (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    (pathname === "/api/catalog" ||
      pathname.startsWith("/api/catalog/") ||
      pathname === "/api/cms" ||
      pathname.startsWith("/api/cms/") ||
      pathname === "/api/commerce-settings")
  );
};

export const fetch: ExportedHandlerFetchHandler<Env> = async (request, environment, context) => {
  const origin = resolveStoreRequestOrigin(request, storeDefinition.profile.slug);
  if (!origin) {
    return rejectedHostResponse();
  }

  const redirect = canonicalRedirect(request, origin);
  if (redirect) {
    return redirect;
  }

  if (isAnonymousCacheCandidate(request)) {
    return context.exports.StorefrontCache.fetch(request);
  }
  return isCacheMutationRequest(request)
    ? context.exports.StorefrontCache.fetch(request)
    : dispatchStoreRequest(request, environment, context);
};
