import { Elysia, t } from "elysia";

export const healthRoute = new Elysia().get(
  "/health",
  () => ({ status: "ok" as const, time: Date.now() }),
  {
    response: t.Object({
      status: t.Literal("ok"),
      time: t.Number(),
    }),
  },
);
