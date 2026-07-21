import { Result } from "better-result";
import { serializeSignedCookie } from "better-call";
import { provisionOwner } from "../staff/operations";
import { createStaffAuth } from "./runtime";

type LocalStaffLoginFailure = {
  readonly code: "infrastructure_unavailable";
};

export const createLocalOwnerSession = async (
  email: string,
  origin: string,
): Promise<Result<{ readonly cookie: string }, LocalStaffLoginFailure>> => {
  const owner = await provisionOwner(email);
  if (owner.isErr()) {
    return Result.err(owner.error);
  }

  const auth = createStaffAuth(origin);
  if (!auth) {
    return Result.err({ code: "infrastructure_unavailable" });
  }

  try {
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
      return Result.err({ code: "infrastructure_unavailable" });
    }
    const cookie = context.authCookies.sessionToken;
    return Result.ok({
      cookie: await serializeSignedCookie(
        cookie.name,
        session.token,
        context.secret,
        cookie.attributes,
      ),
    });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};
