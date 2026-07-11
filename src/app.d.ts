/// <reference types="astro/client" />

type Runtime = import("@astrojs/cloudflare").Runtime;
type AppAuth = (typeof import("./server/lib/auth"))["auth"];
type AppSession = AppAuth["$Infer"]["Session"];

declare namespace App {
  interface Locals extends Runtime {
    user?: AppSession["user"];
    session?: AppSession["session"];
  }
}

interface CacheStorage {
  readonly default: Cache;
}
