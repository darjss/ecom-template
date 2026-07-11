export interface Plan {
  slug: string;
  name: string;
  description: string;
  priceMonthly: number;
  features: string[];
  highlighted: boolean;
}

export const plans: Plan[] = [
  {
    slug: "free",
    name: "Free",
    description: "For trying things out",
    priceMonthly: 0,
    features: ["1 project", "Community support"],
    highlighted: false,
  },
  {
    slug: "pro",
    name: "Pro",
    description: "For serious work",
    priceMonthly: 20,
    features: ["Unlimited projects", "Priority support", "Team members"],
    highlighted: true,
  },
];
