export const createCommerceApi = ({ storeProfile }) => ({
  store: storeProfile.identity,
  endpoints: ["catalog", "availability", "admin", "health"],
});
