import { Elysia } from "elysia";
import { auth } from "@/server/lib/auth";
import { errorPlugin } from "./errors";
import { adminRoute } from "./routes/admin";
import { billingRoute } from "./routes/billing";
import { cacheProofRoute } from "./routes/cache-proof";
import { healthRoute } from "./routes/health";
import { projectsRoute } from "./routes/projects";

export const app = new Elysia({ prefix: "/api", aot: false })
  .use(errorPlugin)
  .mount("/auth", auth.handler)
  .use(healthRoute)
  .use(cacheProofRoute)
  .use(projectsRoute)
  .use(billingRoute)
  .use(adminRoute);

export type App = typeof app;
