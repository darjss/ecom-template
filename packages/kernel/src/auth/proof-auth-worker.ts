import { provisionOwner } from "../staff/operations";
import { createStaffAuth } from "./runtime";
import { serializeSignedCookie } from "better-call";
import { env } from "cloudflare:workers";
import * as v from "valibot";

const EmailSchema = v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email());
const OriginSchema = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    );
  }),
);
const EnvironmentSchema = v.object({ PROOF_CONTROL_TOKEN: v.pipe(v.string(), v.minLength(32)) });
const CreateRequestSchema = v.object({
  action: v.literal("create"),
  email: EmailSchema,
  origin: OriginSchema,
});
const RevokeRequestSchema = v.object({
  action: v.literal("revoke"),
  cookie: v.pipe(v.string(), v.minLength(1)),
  origin: OriginSchema,
});
const ProofRequestSchema = v.variant("action", [CreateRequestSchema, RevokeRequestSchema]);

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });

const createProofSession = async (email: string, origin: string) => {
  const owner = await provisionOwner(email);
  if (owner.isErr()) {
    return json({ error: "owner_unavailable" }, { status: 503 });
  }
  const auth = createStaffAuth(origin);
  if (!auth) {
    return json({ error: "auth_unavailable" }, { status: 503 });
  }
  const context = await auth.$context;
  const adapter = context.internalAdapter;
  const existing = await adapter.findUserByEmail(email);
  let user =
    existing?.user ??
    (await adapter.createUser({
      email,
      emailVerified: true,
      name: email,
    }));
  if (!user.emailVerified) {
    user = await adapter.updateUser(user.id, { emailVerified: true });
  }
  const session = await adapter.createSession(user.id);
  if (!session) {
    return json({ error: "session_unavailable" }, { status: 503 });
  }
  const cookie = context.authCookies.sessionToken;
  const serialized = await serializeSignedCookie(
    cookie.name,
    session.token,
    context.secret,
    cookie.attributes,
  );
  const cookieHeader = serialized.slice(0, serialized.indexOf(";"));
  const verified = await auth.api.getSession({ headers: new Headers({ cookie: cookieHeader }) });
  if (
    !verified ||
    !verified.user.emailVerified ||
    verified.user.email !== email ||
    verified.session.role !== "owner" ||
    typeof verified.session.staffId !== "string"
  ) {
    await adapter.deleteSession(session.token);
    return json({ error: "session_verification_failed" }, { status: 503 });
  }
  return json(
    {
      email: verified.user.email,
      expiresAt: verified.session.expiresAt.toISOString(),
      role: verified.session.role,
      staffId: verified.session.staffId,
    },
    { headers: { "set-cookie": serialized } },
  );
};

const revokeProofSession = async (cookie: string, origin: string) => {
  const auth = createStaffAuth(origin);
  if (!auth) {
    return json({ error: "auth_unavailable" }, { status: 503 });
  }
  const headers = new Headers({ cookie });
  const session = await auth.api.getSession({ headers });
  if (session) {
    await (await auth.$context).internalAdapter.deleteSession(session.session.token);
  }
  const remaining = await auth.api.getSession({ headers });
  return remaining
    ? json({ error: "session_revocation_failed" }, { status: 503 })
    : json({ revoked: true });
};

export default {
  async fetch(request: Request) {
    const environment = v.parse(EnvironmentSchema, env);
    if (request.headers.get("authorization") !== `Bearer ${environment.PROOF_CONTROL_TOKEN}`) {
      return json({ error: "unauthorized" }, { status: 401 });
    }
    const input = v.safeParse(ProofRequestSchema, await request.json());
    if (!input.success) {
      return json({ error: "invalid_request" }, { status: 400 });
    }
    return input.output.action === "create"
      ? createProofSession(input.output.email, input.output.origin)
      : revokeProofSession(input.output.cookie, input.output.origin);
  },
};
