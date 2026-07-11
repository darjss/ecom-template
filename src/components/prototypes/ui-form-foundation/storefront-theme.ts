export type StorefrontThemeTokens = {
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  fontDisplay: string;
  radius: string;
  density: "compact" | "comfortable";
};

export const urnuuTheme: StorefrontThemeTokens = {
  surface: "oklch(0.94 0.035 74)",
  surfaceRaised: "oklch(0.985 0.014 76)",
  text: "oklch(0.24 0.035 52)",
  textMuted: "oklch(0.46 0.035 55)",
  accent: "oklch(0.48 0.12 38)",
  accentText: "oklch(0.98 0.012 75)",
  fontDisplay: 'Georgia, "Times New Roman", serif',
  radius: "0.25rem",
  density: "comfortable",
};

export const themeStyle = (theme: StorefrontThemeTokens) =>
  [
    `--storefront-surface:${theme.surface}`,
    `--storefront-surface-raised:${theme.surfaceRaised}`,
    `--storefront-text:${theme.text}`,
    `--storefront-text-muted:${theme.textMuted}`,
    `--storefront-accent:${theme.accent}`,
    `--storefront-accent-text:${theme.accentText}`,
    `--storefront-font-display:${theme.fontDisplay}`,
    `--storefront-radius:${theme.radius}`,
  ].join(";");
