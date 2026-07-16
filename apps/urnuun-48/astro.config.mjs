import cloudflare from "@astrojs/cloudflare";
import solid from "@astrojs/solid-js";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    configPath: "wrangler.jsonc",
    imageService: "passthrough",
    sessionKVBindingName: "EPHEMERAL_KV",
  }),
  integrations: [solid()],
  fetchFile: null,
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      dedupe: ["solid-js", "solid-js/store", "solid-js/web"],
    },
  },
});
