import { Polar } from "@polar-sh/sdk";
import { plans } from "../src/lib/plans";

const accessToken: string | undefined = process.env.POLAR_ACCESS_TOKEN;
const serverInput: string | undefined = process.env.POLAR_SERVER;
const server = serverInput === "production" ? "production" : "sandbox";

if (!accessToken) {
  console.error("Set POLAR_ACCESS_TOKEN before running this script");
  process.exit(1);
}

const polar = new Polar({ accessToken, server });

const paidPlans = plans.filter((plan) => plan.priceMonthly > 0);

for (const plan of paidPlans) {
  const product = await polar.products.create({
    name: plan.name,
    description: plan.description,
    recurringInterval: "month",
    prices: [
      {
        amountType: "fixed",
        priceAmount: plan.priceMonthly * 100,
        priceCurrency: "usd",
      },
    ],
  });
  console.log(`Created product "${plan.name}" on ${server}: ${product.id}`);
  console.log(`Set POLAR_PRODUCT_ID_${plan.slug.toUpperCase()}=${product.id}`);
}
