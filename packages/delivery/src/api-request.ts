import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import * as v from "valibot";
import { resolveLocalStore } from "./portless";

const EmailSchema = v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email());
const StatusSchema = v.pipe(v.string(), v.regex(/^\d{3}$/), v.transform(Number));
const MethodSchema = v.pipe(v.string(), v.toUpperCase(), v.regex(/^[A-Z]+$/));
const PathSchema = v.pipe(
  v.string(),
  v.check((value) => value === "/api" || value.startsWith("/api/")),
);

const { values, positionals } = parseArgs({
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  allowPositionals: true,
  options: {
    store: { type: "string" },
    owner: { type: "string" },
    expect: { type: "string" },
    json: { type: "string" },
    header: { type: "string", multiple: true, default: [] },
  },
});

const readJsonBody = async () => {
  if (!values.json) {
    return undefined;
  }
  const source = values.json.startsWith("@")
    ? await readFile(values.json.slice(1), "utf8")
    : values.json;
  const parsed: unknown = JSON.parse(source);
  return JSON.stringify(parsed);
};

const readHeaders = () => {
  const headers = new Headers();
  for (const input of values.header) {
    const separator = input.indexOf(":");
    if (separator < 1) {
      throw new Error("Headers must use --header name:value");
    }
    headers.append(input.slice(0, separator).trim(), input.slice(separator + 1).trim());
  }
  return headers;
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "API request failed";

const signOutOwner = async (origin: string, cookie: string) => {
  const response = await fetch(new URL("/api/auth/staff/sign-out", origin), {
    method: "POST",
    headers: { cookie, origin, "content-type": "application/json" },
    body: "{}",
  });
  if (!response.ok) {
    throw new Error(`Local Owner sign-out returned HTTP ${response.status}`);
  }
};

const main = async () => {
  if (!values.store) {
    throw new Error("Missing --store <slug>");
  }
  if (positionals.length < 1 || positionals.length > 2) {
    throw new Error("Usage: pnpm api:request -- --store <slug> [options] [METHOD] /path");
  }

  const store = await resolveLocalStore(values.store);
  const body = await readJsonBody();
  const method = v.parse(
    MethodSchema,
    positionals.length === 2 ? positionals[0] : body ? "POST" : "GET",
  );
  const path = v.parse(PathSchema, positionals.length === 2 ? positionals[1] : positionals[0]);
  const headers = readHeaders();
  if (body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let ownerCookie: string | undefined;
  let primaryError: unknown;
  let signOutError: Error | undefined;
  try {
    if (values.owner) {
      if (headers.has("cookie")) {
        throw new Error("--owner cannot be combined with a Cookie header");
      }
      const email = v.parse(EmailSchema, values.owner);
      const login = await fetch(new URL("/api/auth/staff/dev-login", store.origin), {
        method: "POST",
        headers: {
          origin: store.origin,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ email }),
        redirect: "manual",
      });
      if (login.status !== 303) {
        throw new Error(`Local Owner login returned HTTP ${login.status}`);
      }
      ownerCookie = login.headers.getSetCookie().at(0)?.split(";", 1).at(0);
      if (!ownerCookie) {
        throw new Error("Local Owner login did not return a session cookie");
      }
      headers.set("cookie", ownerCookie);
    }

    const response = await fetch(new URL(path, store.origin), {
      method,
      headers,
      ...(body === undefined ? {} : { body }),
      redirect: "manual",
    });
    process.stderr.write(`HTTP ${response.status}\n`);
    const source = await response.text();
    if (source.length > 0) {
      process.stdout.write(`${source}\n`);
    }

    if (values.expect) {
      const expected = v.parse(StatusSchema, values.expect);
      if (response.status !== expected) {
        throw new Error(`Expected HTTP ${expected}, received ${response.status}`);
      }
    } else if (!response.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    if (ownerCookie) {
      try {
        await signOutOwner(store.origin, ownerCookie);
      } catch (error) {
        if (primaryError !== undefined) {
          process.stderr.write(`Owner sign-out also failed: ${errorMessage(error)}\n`);
        } else {
          signOutError = new Error(errorMessage(error));
        }
      }
    }
  }
  if (signOutError !== undefined) {
    throw new Error(signOutError.message, { cause: signOutError });
  }
};

await main().catch((error: unknown) => {
  process.stderr.write(`${errorMessage(error)}\n`);
  process.exitCode = 1;
});
