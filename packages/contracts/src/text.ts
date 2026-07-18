import * as v from "valibot";

export const normalizeText = (value: string) => value.normalize("NFKC");

export const NormalizedTextSchema = v.pipe(v.string(), v.transform(normalizeText));
