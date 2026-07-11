import { sequence } from "astro:middleware";
import { edgeCache } from "./edge-cache";
import { sessionGuard } from "./session-guard";

export const onRequest = sequence(edgeCache, sessionGuard);
