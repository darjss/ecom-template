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
  const existingSessions = await adapter.listSessions(user.id, { onlyActiveSessions: true });
  if (existingSessions.length > 0) {
    return json({ error: "active_session_exists" }, { status: 409 });
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
  const activeSessions = await adapter.listSessions(user.id, { onlyActiveSessions: true });
  if (activeSessions.length !== 1 || activeSessions[0]?.token !== session.token) {
    await adapter.deleteSession(session.token);
    return json({ error: "session_count_invalid" }, { status: 503 });
  }
  return json(
    {
      email: verified.user.email,
      expiresAt: verified.session.expiresAt.toISOString(),
      role: verified.session.role,
      staffId: verified.session.staffId,
      activeSessionCount: activeSessions.length,
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
  const adapter = (await auth.$context).internalAdapter;
  if (session) {
    await adapter.deleteSession(session.session.token);
  }
  const remaining = await auth.api.getSession({ headers });
  const activeSessions = session
    ? await adapter.listSessions(session.user.id, { onlyActiveSessions: true })
    : [];
  return remaining || activeSessions.length > 0
    ? json({ error: "session_revocation_failed" }, { status: 503 })
    : json({ revoked: true, activeSessionCount: 0 });
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
