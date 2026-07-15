interface CacheRule {
  pattern: RegExp;
  sMaxAge: number;
  staleWhileRevalidate: number;
  cacheTag?: string;
}

export const cacheRules: CacheRule[] = [
  { pattern: /^\/$/, sMaxAge: 300, staleWhileRevalidate: 3600 },
  { pattern: /^\/pricing\/?$/, sMaxAge: 300, staleWhileRevalidate: 3600 },
  {
    pattern: /^\/prototype\/products\/[^/]+\/?$/,
    sMaxAge: 1_209_600,
    staleWhileRevalidate: 0,
    cacheTag: "wf25-product",
  },
];

export const cacheRuleFor = (pathname: string) =>
  cacheRules.find((rule) => rule.pattern.test(pathname));
