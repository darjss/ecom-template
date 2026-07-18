import { CatalogSlugSchema } from "@ecom/contracts";
import * as v from "valibot";

const QuerySchema = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(120),
  v.check((value) => value.length === 0 || /[\p{L}\p{N}]/u.test(value)),
);
const PositiveIntegerSchema = v.pipe(
  v.string(),
  v.regex(/^\d+$/),
  v.transform(Number),
  v.integer(),
);

type SearchParameterOptions = {
  readonly allowEmptyQuery: boolean;
  readonly allowLimit: boolean;
};

export const parseCatalogSearchParameters = (
  parameters: URLSearchParams,
  options: SearchParameterOptions,
) => {
  const accepted = new Set([
    "q",
    "category",
    "collection",
    "page",
    ...(options.allowLimit ? ["limit"] : []),
  ]);
  const queryValues = parameters.getAll("q");
  const categoryValues = parameters.getAll("category");
  const collectionValues = parameters.getAll("collection");
  const pageValues = parameters.getAll("page");
  const limitValues = parameters.getAll("limit");
  const query = v.safeParse(QuerySchema, queryValues[0] ?? "");
  const category = categoryValues.length
    ? v.safeParse(CatalogSlugSchema, categoryValues[0])
    : undefined;
  const collection = collectionValues.length
    ? v.safeParse(CatalogSlugSchema, collectionValues[0])
    : undefined;
  const page = v.safeParse(
    v.pipe(PositiveIntegerSchema, v.minValue(1), v.maxValue(100)),
    pageValues[0] ?? "1",
  );
  const limit = v.safeParse(
    v.pipe(PositiveIntegerSchema, v.minValue(1), v.maxValue(48)),
    limitValues[0] ?? "24",
  );
  const value = {
    query: query.success ? query.output : "",
    ...(category?.success ? { category: category.output } : {}),
    ...(collection?.success ? { collection: collection.output } : {}),
    page: page.success ? page.output : 1,
    limit: limit.success ? limit.output : 24,
  };
  const success =
    ![...parameters.keys()].some((key) => !accepted.has(key)) &&
    queryValues.length <= 1 &&
    categoryValues.length <= 1 &&
    collectionValues.length <= 1 &&
    pageValues.length <= 1 &&
    (!options.allowLimit || limitValues.length <= 1) &&
    query.success &&
    (options.allowEmptyQuery || query.output.length > 0) &&
    category?.success !== false &&
    collection?.success !== false &&
    page.success &&
    (!options.allowLimit || limit.success);
  return { success, value } as const;
};
