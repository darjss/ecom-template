import { treaty } from "@elysiajs/eden";
import type { App } from "@/server/api/app";
import type { ErrorCode, ErrorEnvelope } from "@/server/api/errors";

const origin = typeof window === "undefined" ? "http://localhost:4321" : window.location.origin;

export const api = treaty<App>(origin, {
  fetch: { credentials: "include" },
}).api;

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const isEnvelope = (value: unknown): value is ErrorEnvelope =>
  typeof value === "object" &&
  value !== null &&
  "error" in value &&
  typeof value.error === "object";

interface TreatyResult<T, E, S> {
  data: T | null;
  error: { status: S; value: E } | null;
}

export const unwrap = <T, E, S>(result: TreatyResult<T, E, S>): T => {
  if (result.error) {
    const { value } = result.error;
    const status = typeof result.error.status === "number" ? result.error.status : 0;
    if (isEnvelope(value)) {
      throw new ApiError(value.error.code, value.error.message, status, value.error.details);
    }
    throw new ApiError("internal", "Request failed", status);
  }
  if (result.data === null) {
    throw new ApiError("internal", "Empty response", 0);
  }
  return result.data;
};

export const queryErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
};
