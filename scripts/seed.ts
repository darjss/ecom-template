import { createId } from "@paralleldrive/cuid2";
import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { account, project, user } from "../src/server/db/schema";

const d1Dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";

const localDatabaseFile = () => {
  const file = readdirSync(d1Dir).find(
    (name) => name.endsWith(".sqlite") && name !== "metadata.sqlite",
  );
  if (!file) throw new Error(`No local D1 database in ${d1Dir} — run pnpm db:migrate:local first`);
  return join(d1Dir, file);
};

const seed = async () => {
  const db = drizzle(new Database(localDatabaseFile()));
  const email = "admin@example.com";
  const password = "password123";

  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existing.length > 0) {
    console.log(`Seed user ${email} already exists, skipping`);
    return;
  }

  const userId = createId();
  const now = new Date();

  await db.insert(user).values({
    id: userId,
    email,
    name: "Admin",
    emailVerified: true,
    role: "admin",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(account).values({
    id: createId(),
    userId,
    providerId: "credential",
    accountId: userId,
    password: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(project).values({ name: "Demo project", ownerId: userId });

  console.log(`Seeded ${email} (password: ${password}) with one demo project`);
};

await seed();
