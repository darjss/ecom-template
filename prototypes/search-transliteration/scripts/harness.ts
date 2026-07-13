type Mode = "strict" | "basic";
type Product = { name: string; sku: string };
type SearchResponse = { products: Product[]; timing_ms: { total: number; sql: number }; counts: { exact_sku: number; lexical: number } };
type Case = { label: string; query: string; expected: string | null };

const args = Bun.argv.slice(2);
const urlArg = args.find((arg) => arg.startsWith("--url="))?.slice(6) ?? args[0];
const interactive = args.find((arg) => arg.startsWith("--query="))?.slice(8);
if (!urlArg) throw new Error("usage: bun run harness -- --url=https://... [--query=өдөр]");
const baseUrl = urlArg.replace(/\/$/, "");
const cases: Case[] = [
  { label: "Cyrillic title", query: "ноосон", expected: "Ноосон цамц" }, { label: "uppercase Cyrillic", query: "НООСОН", expected: "Ноосон цамц" }, { label: "strict Latin", query: "usnii boolt", expected: "Үсний боолт" }, { label: "basic Monglish", query: "usnii boolt", expected: "Үсний боолт" }, { label: "mixed script", query: "ноосон tsamts", expected: "Ноосон цамц" }, { label: "punctuation", query: "ноосон-цамц", expected: "Ноосон цамц" }, { label: "SKU separators", query: "HVӨ001", expected: "Ноосон цамц" }, { label: "distinct ө/о", query: "одор", expected: null }, { label: "distinct ү/у", query: "үс", expected: null }, { label: "prefix", query: "ноо", expected: "Ноосон цамц" }, { label: "no match", query: "квантын дуран", expected: null }
];
const parse = (value: unknown): SearchResponse => {
  if (!value || typeof value !== "object") throw new Error("unexpected response");
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.products) || typeof record.timing_ms !== "object" || typeof record.counts !== "object") throw new Error("unexpected response");
  return { products: record.products as Product[], timing_ms: record.timing_ms as SearchResponse["timing_ms"], counts: record.counts as SearchResponse["counts"] };
};
const run = async (query: string, mode: Mode): Promise<{ data: SearchResponse; networkMs: number }> => {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/search?q=${encodeURIComponent(query)}&mode=${mode}`);
  const data = parse(await response.json());
  return { data, networkMs: Number((performance.now() - started).toFixed(2)) };
};
const percentile = (values: number[], p: number): number => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0; };
const isBasicCase = (item: Case): boolean => item.label === "basic Monglish" || item.label === "distinct ө/о" || item.label === "distinct ү/у";
let hits = 0; let misses = 0; let collisions = 0;
for (const mode of ["strict", "basic"] as const) {
  console.log(`\nMODE ${mode}`);
  for (const item of cases) {
    const expected = mode === "basic" && isBasicCase(item) && item.label.startsWith("distinct") ? (item.label === "distinct ө/о" ? "Өдөр тутмын цүнх" : "Үсний боолт") : item.expected;
    const result = await run(interactive && mode === "strict" ? interactive : item.query, mode);
    const names = result.data.products.map((product) => product.name);
    const pass = expected === null ? names.length === 0 : names.includes(expected);
    if (pass) hits++; else misses++;
    if (names.length > 1) collisions++;
    console.log(JSON.stringify({ label: item.label, query: interactive && mode === "strict" ? interactive : item.query, expected, returned: names, pass, network_ms: result.networkMs, worker_ms: result.data.timing_ms.total, sql_ms: result.data.timing_ms.sql }));
  }
}
const warm: number[] = [];
const first = await run("ноосон цамц", "strict");
for (let index = 0; index < 20; index++) warm.push((await run("ноосон цамц", "strict")).networkMs);
console.log(JSON.stringify({ summary: { cases: cases.length * 2, hits, misses, collisions }, latency_ms: { first_request_network: first.networkMs, warm_network_p50: percentile(warm, 0.5), warm_network_p95: percentile(warm, 0.95), warm_worker_last: (await run("ноосон цамц", "strict")).data.timing_ms.total }, note: "network_ms is observed from this machine; worker/sql_ms is emitted inside the Worker" }));
