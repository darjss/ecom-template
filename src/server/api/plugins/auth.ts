import { Elysia } from "elysia";
import { auth } from "@/server/lib/auth";
import { ForbiddenError, UnauthorizedError } from "../errors";

export const authPlugin = new Elysia({ name: "auth" })
  .derive({ as: "scoped" }, async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return {
      user: session?.user ?? null,
      session: session?.session ?? null,
    };
  })
  .macro({
    requireAuth: {
      transform: ({ user, session }) => {
        if (!user || !session) throw new UnauthorizedError();
      },
      resolve: ({ user, session }) => {
        if (!user || !session) throw new UnauthorizedError();
        return { user, session };
      },
    },
    requireAdmin: {
      transform: ({ user, session }) => {
        if (!user || !session) throw new UnauthorizedError();
        if (user.role !== "admin") throw new ForbiddenError();
      },
      resolve: ({ user, session }) => {
        if (!user || !session) throw new UnauthorizedError();
        if (user.role !== "admin") throw new ForbiddenError();
        return { user, session };
      },
    },
  });
