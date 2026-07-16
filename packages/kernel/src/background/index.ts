import { env } from "cloudflare:workers";

export type StoreBackground = {
  readonly recordScheduledTick: (scheduledAt: Date) => Promise<void>;
};

export const createStoreBackground = (): StoreBackground => ({
  recordScheduledTick: async (scheduledAt) => {
    await env.EPHEMERAL_KV.put("background:last-scheduled-at", scheduledAt.toISOString(), {
      expirationTtl: 86_400,
    });
  },
});
