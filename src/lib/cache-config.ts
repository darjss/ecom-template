interface CacheRule {
  pattern: RegExp;
  sMaxAge: number;
  staleWhileRevalidate: number;
}

export const cacheRules: CacheRule[] = [
  { pattern: /^\/$/, sMaxAge: 300, staleWhileRevalidate: 3600 },
  { pattern: /^\/pricing\/?$/, sMaxAge: 300, staleWhileRevalidate: 3600 },
];

export const cacheRuleFor = (pathname: string) =>
  cacheRules.find((rule) => rule.pattern.test(pathname));
