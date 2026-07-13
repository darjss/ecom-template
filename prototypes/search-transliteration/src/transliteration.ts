export const TRANSLITERATION_VERSION = "strict-mn-v1-basic-v1";

const strictMap: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", ө: "ö", п: "p", р: "r", с: "s", т: "t", у: "u", ү: "ü", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya"
};

export const normalize = (input: string): string => input.normalize("NFKC").toLocaleLowerCase("mn-MN").normalize("NFC").replace(/[\p{P}\p{S}\s]+/gu, " ").trim();

export const transliterateStrict = (input: string): string => [...normalize(input)].map((char) => strictMap[char] ?? char).join("");

export const transliterateBasic = (input: string): string => transliterateStrict(input).replaceAll("ö", "o").replaceAll("ü", "u").replaceAll("kh", "h").replaceAll("y", "i");

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
