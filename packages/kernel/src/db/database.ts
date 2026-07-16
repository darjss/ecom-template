import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

export const database = () => drizzle(env.DB);
