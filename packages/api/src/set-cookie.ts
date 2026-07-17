export const forwardSetCookies = (
  source: Headers,
  target: Record<string, string | number | readonly string[]>,
) => {
  const cookies = source.getSetCookie();
  if (cookies.length > 0) {
    target["set-cookie"] = cookies;
  }
};
