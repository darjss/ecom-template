import { desc } from "drizzle-orm";
import { Elysia } from "elysia";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { authPlugin } from "../plugins/auth";

export const adminRoute = new Elysia({ prefix: "/admin" }).use(authPlugin).get(
  "/users",
  () =>
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt)),
  { requireAdmin: true },
);
