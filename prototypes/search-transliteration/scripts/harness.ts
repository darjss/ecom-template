type Mode = "strict" | "basic" | "tiered";
type Source = "sku_exact" | "native" | "strict_transliteration" | "basic_fallback";
type Product = { name: string; sku: string; source?: Source; confidence?: string };
type SearchResponse = { products: Product[]; timing_ms: { total: number; sql: number }; source: Source; confidence: string; ambiguity: string };
type Case = { label: string; query: string; expectedNames: string[]; expectedSource?: Source; expectedEmpty?: boolean };

const args = Bun.argv.slice(2);
const urlArg = args.find((arg) => arg.startsWith("--url="))?.slice(6) ?? args[0];
const interactive = args.find((arg) => arg.startsWith("--query="))?.slice(8);
if (!urlArg) throw new Error("usage: bun run harness -- --url=https://... [--query=өдөр]");
const baseUrl = urlArg.replace(/\/$/, "");
const cases: Case[] = [
  { label: "odor basic ambiguity", query: "odor", expectedNames: ["Өдөр тутмын цүнх", "Ердийн даашинз"], expectedSource: "basic_fallback" },
  { label: "udur basic ambiguity", query: "udur", expectedNames: ["Өдөр тутмын цүнх", "Ердийн даашинз"], expectedSource: "basic_fallback" },
  { label: "Monglish үсний", query: "usnii boolt", expectedNames: ["Үсний боолт"], expectedSource: "basic_fallback" },
  { label: "strict digraph цамц", query: "nooson tsamts", expectedNames: ["Ноосон цамц", "Ноосон-цамц"], expectedSource: "strict_transliteration" },
  { label: "mixed script", query: "ноосон tsamts", expectedNames: ["Ноосон цамц", "Ноосон-цамц"], expectedSource: "strict_transliteration" },
  { label: "native ө/о", query: "өдөр", expectedNames: ["Өдөр тутмын цүнх", "Ердийн даашинз"], expectedSource: "native" },
  { label: "native ү/у", query: "үс", expectedNames: ["Үсний боолт"], expectedSource: "native" },
  { label: "native у", query: "ус", expectedNames: ["Цэвэр усны сав"], expectedSource: "native" },
  { label: "ё/е no silent merge", query: "ес", expectedNames: [], expectedEmpty: true },
  { label: "strict х digraph", query: "khuvtsas", expectedNames: ["Ноосон цамц"], expectedSource: "strict_transliteration" },
  { label: "strict ц digraph", query: "tsagaan", expectedNames: ["Цагаан цамц"], expectedSource: "strict_transliteration" },
  { label: "SKU exact", query: "HVӨ001", expectedNames: ["Ноосон цамц"], expectedSource: "sku_exact" },
  { label: "SKU punctuation", query: "hv-ц-002", expectedNames: ["Өдөр тутмын цүнх"], expectedSource: "sku_exact" },
  { label: "prefix", query: "ноо", expectedNames: ["Ноосон цамц", "Ноосон-цамц"], expectedSource: "native" },
  { label: "no match", query: "квантын дуран", expectedNames: [], expectedEmpty: true }
];
const parse = (value: unknown): SearchResponse => {
  if (!value || typeof value !== "object") throw new Error("unexpected response");
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.products) || typeof record.timing_ms !== "object" || typeof record.source !== "string") throw new Error("unexpected response");
  return { products: record.products as Product[], timing_ms: record.timing_ms as SearchResponse["timing_ms"], source: record.source as Source, confidence: String(record.confidence), ambiguity: String(record.ambiguity) };
};
const run = async (query: string, mode: Mode): Promise<{ data: SearchResponse; networkMs: number }> => {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/search?q=${encodeURIComponent(query)}&mode=${mode}`);
  if (!response.ok) throw new Error(`${mode} ${query}: HTTP ${response.status}`);
  return { data: parse(await response.json()), networkMs: Number((performance.now() - started).toFixed(2)) };
};
const percentile = (values: number[], p: number): number => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0; };
const sameNames = (actual: string[], expected: string[]): boolean => expected.every((name) => actual.includes(name));
let assertions = 0; let passed = 0; let failed = 0; let collisions = 0;
for (const mode of ["strict", "basic", "tiered"] as const) {
  console.log(`\nMODE ${mode}`);
  for (const item of cases) {
    const query = interactive && mode === "tiered" ? interactive : item.query;
    const result = await run(query, mode);
    const names = result.data.products.map((product) => product.name);
    if (mode === "tiered") {
      assertions++;
      const namesPass = item.expectedEmpty ? names.length === 0 : sameNames(names, item.expectedNames);
      const sourcePass = !item.expectedSource || result.data.source === item.expectedSource;
      const pass = namesPass && sourcePass;
      if (pass) passed++; else failed++;
      console.log(JSON.stringify({ label: item.label, query, expected_names: item.expectedNames, expected_source: item.expectedSource, returned: names, source: result.data.source, confidence: result.data.confidence, ambiguity: result.data.ambiguity, pass, network_ms: result.networkMs, worker_ms: result.data.timing_ms.total, d1_sql_ms: result.data.timing_ms.sql }));
    } else {
      console.log(JSON.stringify({ label: item.label, query: item.query, returned: names, source: result.data.source, confidence: result.data.confidence, ambiguity: result.data.ambiguity, network_ms: result.networkMs, worker_ms: result.data.timing_ms.total, d1_sql_ms: result.data.timing_ms.sql }));
    }
    if (names.length > 1) collisions++;
  }
}
const warm: number[] = []; const warmWorker: number[] = []; const warmD1: number[] = [];
const first = await run("odor", "tiered");
for (let index = 0; index < 60; index++) { const result = await run(index % 2 === 0 ? "odor" : "nooson tsamts", "tiered"); warm.push(result.networkMs); warmWorker.push(result.data.timing_ms.total); warmD1.push(result.data.timing_ms.sql); }
console.log(JSON.stringify({ summary: { tiered_cases: assertions, passed, failed, collisions }, latency_ms: { first_network: first.networkMs, warm_network_p50: percentile(warm, 0.5), warm_network_p95: percentile(warm, 0.95), warm_worker_p50: percentile(warmWorker, 0.5), warm_worker_p95: percentile(warmWorker, 0.95), warm_d1_sql_p50: percentile(warmD1, 0.5), warm_d1_sql_p95: percentile(warmD1, 0.95) }, note: "network_ms is observed from this machine in Mongolia; worker_ms is inside the Worker; d1_sql_ms is the measured D1 query segment" }));
