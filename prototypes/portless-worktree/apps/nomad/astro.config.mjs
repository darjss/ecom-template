import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: { enabled: true, remoteBindings: false },
    imageService: "passthrough",
  }),
});
