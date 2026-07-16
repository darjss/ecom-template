import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import * as v from "valibot";
import { DeliveryManifestSchema } from "./index";

const write = (value: string) => process.stdout.write(`${value}\n`);
const fail = (value: string) => {
  process.stderr.write(`${value}\n`);
  process.exitCode = 1;
};

const help = `store-delivery

Commands:
  validate --manifest <path>     Validate a delivery manifest
  apply --manifest <path>        Reserved for reviewed provisioning work
  --help                         Show this help`;

const readManifestPath = () => {
  const index = process.argv.indexOf("--manifest");
  return index >= 0 ? process.argv.at(index + 1) : undefined;
};

const command = process.argv.slice(2).find((argument) => argument !== "--");
if (!command || command === "--help" || command === "help") {
  write(help);
} else if (command === "validate") {
  const manifestPath = readManifestPath();
  if (!manifestPath) {
    fail("Missing --manifest <path>");
  } else {
    const source = await readFile(manifestPath, "utf8");
    const parsed: unknown = parse(source);
    const manifest = v.parse(DeliveryManifestSchema, parsed);
    write(`Valid manifest with ${Object.keys(manifest.targets).length} target(s)`);
  }
} else if (command === "apply") {
  fail(
    "Provisioning is intentionally unavailable in bootstrap. Use a reviewed delivery implementation.",
  );
} else {
  fail(`Unknown command: ${command}`);
}
