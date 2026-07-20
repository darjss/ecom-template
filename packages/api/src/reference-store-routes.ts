import {
  installReferenceStoreFixture,
  proveReferenceStoreFixture,
  ReferenceStoreFixtureSchema,
  synchronizeReferenceStoreMedia,
  type StaffActor,
} from "@ecom/kernel";
import { env } from "cloudflare:workers";
import { Elysia } from "elysia";
import * as v from "valibot";

const ReferenceStoreLocalTokenSchema = v.pipe(v.string(), v.minLength(1));

type Status = (code: number, body: unknown) => unknown;
type AuthorizeReferenceStoreRoute = (
  request: Request,
  status: Status,
) => Promise<
  | { readonly authorized: true; readonly actor: StaffActor }
  | { readonly authorized: false; readonly response: unknown }
>;

const authorize = async (
  request: Request,
  status: Status,
  authorizeStaff: AuthorizeReferenceStoreRoute,
) => {
  const localToken = v.safeParse(ReferenceStoreLocalTokenSchema, env.REFERENCE_STORE_LOCAL_TOKEN);
  if (
    localToken.success &&
    request.headers.get("x-reference-store-local-token") === localToken.output
  ) {
    return { authorized: true as const, local: true as const };
  }
  const authorization = await authorizeStaff(request, status);
  if (!authorization.authorized) {
    return authorization;
  }
  return authorization.actor.role === "owner"
    ? { authorized: true as const, local: false as const }
    : {
        authorized: false as const,
        response: status(403, {
          error: { code: "forbidden", message: "Owner authority is required" },
        }),
      };
};

export const createReferenceStoreRoutes = (authorizeStaff: AuthorizeReferenceStoreRoute) =>
  new Elysia({ aot: false })
    .put("/reference-store/media/:fileName", async ({ body, params, request, status }) => {
      const fileName = v.safeParse(
        v.pipe(v.string(), v.regex(/^[a-z0-9-]+\.webp$/)),
        params.fileName,
      );
      const expectedSha256 = v.safeParse(
        v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
        request.headers.get("x-reference-media-sha256"),
      );
      if (!fileName.success || !expectedSha256.success) {
        return status(422, {
          error: {
            code: "validation",
            message: "Valid Reference Store media metadata is required",
          },
        });
      }
      const authorization = await authorize(request, status, authorizeStaff);
      if (!authorization.authorized) {
        return authorization.response;
      }
      const bytes =
        body instanceof ArrayBuffer
          ? new Uint8Array(body)
          : body instanceof Uint8Array
            ? body
            : null;
      if (!bytes) {
        return status(422, {
          error: { code: "validation", message: "Reference Store media bytes are required" },
        });
      }
      return {
        data: await synchronizeReferenceStoreMedia(fileName.output, expectedSha256.output, bytes),
      };
    })
    .put("/reference-store/fixture", async ({ body, request, status }) => {
      const fixture = v.safeParse(ReferenceStoreFixtureSchema, body);
      if (!fixture.success) {
        return status(422, {
          error: { code: "validation", message: "A valid Reference Store fixture is required" },
        });
      }
      const authorization = await authorize(request, status, authorizeStaff);
      if (!authorization.authorized) {
        return authorization.response;
      }
      return {
        data: await installReferenceStoreFixture(fixture.output, !authorization.local),
      };
    })
    .post("/reference-store/fixture/proof", async ({ body, request, status }) => {
      const fixture = v.safeParse(ReferenceStoreFixtureSchema, body);
      if (!fixture.success) {
        return status(422, {
          error: { code: "validation", message: "A valid Reference Store fixture is required" },
        });
      }
      const authorization = await authorize(request, status, authorizeStaff);
      if (!authorization.authorized) {
        return authorization.response;
      }
      return { data: await proveReferenceStoreFixture(fixture.output) };
    });
