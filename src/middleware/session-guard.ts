import { defineMiddleware } from "astro:middleware";
import { auth } from "@/server/lib/auth";

export const sessionGuard = defineMiddleware(async (context, next) => {
  if (!context.url.pathname.startsWith("/app")) return next();

  const session = await auth.api.getSession({ headers: context.request.headers });
  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(context.url.pathname)}`);
  }

  context.locals.user = session.user;
  context.locals.session = session.session;
  return next();
});
