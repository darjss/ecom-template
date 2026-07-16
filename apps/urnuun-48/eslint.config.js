import antfu from "@antfu/eslint-config";

export default antfu(
  {
    astro: true,
    stylistic: false,
    typescript: false,
    ignores: [".astro/**", "dist/**", "src/**/*.{ts,tsx}"],
  },
  {
    files: ["src/**/*.astro"],
    rules: {
      "astro/no-conflict-set-directives": "error",
      "astro/no-deprecated-astro-canonicalurl": "error",
      "perfectionist/sort-imports": "off",
    },
  },
);
