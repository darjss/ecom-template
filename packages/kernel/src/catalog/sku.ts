import { fullUnicodeCaseFold } from "./sku-case-fold";

export const compactSku = (value: string) =>
  fullUnicodeCaseFold(value.normalize("NFKC"))
    .normalize("NFC")
    .trim()
    .replaceAll(/[-/\p{White_Space}]/gu, "");
