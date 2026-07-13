export const TRANSLITERATION_VERSION = "strict-mn-v2-tiered-basic-v2";

const strictMap: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", ө: "ö", п: "p", р: "r", с: "s", т: "t", у: "u", ү: "ü", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya"
};
const strictAsciiMap: Record<string, string> = { ...strictMap, ө: "oe", ү: "ue" };
const basicAlternatives: Record<string, string[]> = { ө: ["o", "u"], ү: ["u", "i"], ё: ["yo", "eo"], й: ["i", "y"], х: ["h", "kh"], ц: ["c", "ts"] };

export const normalize = (input: string): string => input.normalize("NFKC").toLocaleLowerCase("mn-MN").normalize("NFC").replace(/[\p{P}\p{S}\s]+/gu, " ").trim();
export const transliterateStrict = (input: string): string => [...normalize(input)].map((char) => strictMap[char] ?? char).join("");
export const transliterateStrictAscii = (input: string): string => [...normalize(input)].map((char) => strictAsciiMap[char] ?? char).join("");
export const transliterateBasic = (input: string): string => transliterateStrictAscii(input).replaceAll("y", "i").replaceAll("oe", "o").replaceAll("ue", "u");

export const basicTokenVariants = (input: string): string[][] => normalize(input).split(" ").filter((word) => word.length >= 2).map((word) => {
  let variants = [""];
  for (const char of [...word]) {
    const choices = basicAlternatives[char] ?? [strictAsciiMap[char] ?? char];
    variants = variants.flatMap((prefix) => choices.map((choice) => `${prefix}${choice}`)).slice(0, 8);
  }
  return [...new Set(variants)];
});

export const basicVariants = (input: string): string[] => basicTokenVariants(input).flat();

export const keyFor = (input: string, mode: "strict" | "basic"): string => {
  const normalized = normalize(input);
  const transliteration = mode === "strict" ? transliterateStrict(normalized) : transliterateBasic(normalized);
  return `${normalized} ${transliteration}`.trim();
};

export const tokensFor = (input: string, mode: "strict" | "basic"): string[][] => {
  const normalized = normalize(input).split(" ").filter((term) => term.length >= 2);
  const transliteration = (mode === "strict" ? transliterateStrict(input) : transliterateBasic(input)).split(" ");
  return normalized.map((term, index) => [...new Set([term, transliteration[index] ?? term].filter((candidate) => candidate.length >= 2))]);
};
