type Product = { name: string; sku: string; brand: string; category: string; price_mnt: number; available: boolean; source?: string; confidence?: string; matched_field?: string };
type ProductResponse = { products: Product[] };
type SearchResponse = { products: Product[]; source: string; confidence: string; ambiguity: string; timing_ms: { total: number; sql: number; binding_calls: number } };

const prototypeUrl = "https://wf19-search-transliteration-worker.darjs.workers.dev";
const args = Bun.argv.slice(2);
const urlIndex = args.findIndex((arg) => arg === "--url" || arg.startsWith("--url="));
const url = (urlIndex >= 0 ? (args[urlIndex].startsWith("--url=") ? args[urlIndex].slice(6) : args[urlIndex + 1]) : prototypeUrl).replace(/\/$/, "");
const queryArgs = args.filter((arg, index) => arg !== "--list" && !arg.startsWith("--url=") && arg !== "--url" && (urlIndex < 0 || index !== urlIndex + 1));
const listMode = args.length === 0 || args.includes("--list");
const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json() as T;
};

if (listMode) {
  const response = await parseJson<ProductResponse>(await fetch(`${url}/products?limit=18`));
  console.log(`PROTOTYPE catalog: ${url}`);
  for (const product of response.products) console.log(`${product.name} | ${product.sku} | ${product.brand} | ${product.category} | ${product.price_mnt.toLocaleString("en-US")} MNT | ${product.available ? "available" : "unavailable"}`);
  console.log("\nTry: өдөр | odor | udur | usnii boolt | nooson tsamts");
  console.log("Usage: bun prototypes/search-transliteration/scripts/try-search.ts [--url URL] <query>");
} else {
  const query = queryArgs.join(" ").trim();
  if (!query) throw new Error("Provide a query or use --list");
  const started = performance.now();
  const response = await parseJson<SearchResponse>(await fetch(`${url}/search?q=${encodeURIComponent(query)}&mode=tiered`));
  const networkMs = Number((performance.now() - started).toFixed(2));
  console.log(`Query: ${query}`);
  console.log(`Source: ${response.source} | confidence: ${response.confidence} | ambiguity: ${response.ambiguity}`);
  console.log(`Timing: network ${networkMs}ms | Worker ${response.timing_ms.total}ms | D1 ${response.timing_ms.sql}ms | bindings ${response.timing_ms.binding_calls}`);
  if (response.products.length === 0) console.log("No products matched.");
  for (const product of response.products) console.log(`- ${product.name} | ${product.sku} | ${product.brand} | ${product.category} | ${product.matched_field ?? "unknown"} | ${product.source ?? response.source} | ${product.confidence ?? response.confidence} | ${product.available ? "available" : "unavailable"}`);
}
