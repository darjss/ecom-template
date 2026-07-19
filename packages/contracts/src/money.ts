import * as v from "valibot";

export const MoneyMntSchema = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.maxValue(100_000_000_000_000),
);
