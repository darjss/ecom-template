export const commerceCachePolicy = {
  publicHtmlSeconds: 86400,
  staleWhileRevalidateSeconds: 604800,
  availability: "no-store",
  privateRoutes: ["/cart", "/checkout", "/api/orders", "/api/admin"],
};
