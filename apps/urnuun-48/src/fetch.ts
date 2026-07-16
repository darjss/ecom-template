import { handle } from "@astrojs/cloudflare/handler";
import { authorizeStaffRequest, resolveStoreRequestOrigin } from "@ecom/api";
import { isPublicCacheTagHeader } from "@ecom/storefront/cache";
import { api } from "./api";
import { storeDefinition } from "./profile/definition";

const publicStorefrontPaths = new Set(["/", "/story"]);

const privateResponse = (response: Response) => {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-store");
  headers.delete("cloudflare-cdn-cache-control");
  headers.delete("cache-tag");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const classifyResponse = (request: Request, response: Response) => {
  const requestUrl = new URL(request.url);
  const cacheTags = response.headers.get("cache-tag");
  const retainsPublicPolicy =
    (request.method === "GET" || request.method === "HEAD") &&
    response.status === 200 &&
    publicStorefrontPaths.has(requestUrl.pathname) &&
    requestUrl.search === "" &&
    !request.headers.has("authorization") &&
    !request.headers.has("cookie") &&
    !response.headers.has("set-cookie") &&
    response.headers.get("content-type")?.startsWith("text/html") === true &&
    response.headers.get("cache-control") === "public, max-age=0, must-revalidate" &&
    response.headers.get("cloudflare-cdn-cache-control") === "public, max-age=1209600" &&
    cacheTags !== null &&
    isPublicCacheTagHeader(cacheTags);
  return retainsPublicPolicy ? response : privateResponse(response);
};

const rejectedHostResponse = () =>
  Response.json(
    { error: { code: "validation", message: "Request host is not accepted" } },
    { status: 421, headers: { "cache-control": "private, no-store" } },
  );

export const fetch: ExportedHandlerFetchHandler<Env> = async (request, environment, context) => {
  const origin = resolveStoreRequestOrigin(request, storeDefinition.profile.slug);
  if (!origin) {
    return rejectedHostResponse();
  }

  const pathname = new URL(request.url).pathname;
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return privateResponse(await api.fetch(request));
  }
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    let authorized = false;
    try {
      authorized = await authorizeStaffRequest(request, {
        profile: storeDefinition.profile,
        providers: storeDefinition.providers,
      });
    } catch {
      return privateResponse(
        Response.json(
          { error: { code: "unavailable", message: "Staff authorization is unavailable" } },
          { status: 503 },
        ),
      );
    }
    if (!authorized) {
      return new Response(null, {
        status: 303,
        headers: {
          location: new URL("/admin/login", origin).toString(),
          "cache-control": "private, no-store",
        },
      });
    }
  }
  return classifyResponse(request, await handle(request, environment, context));
};
