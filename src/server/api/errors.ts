import { Elysia } from "elysia";

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "rate_limited"
  | "internal";

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

const statusByCode: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation: 422,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }

  get status() {
    return statusByCode[this.code];
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("unauthorized", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super("forbidden", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super("not_found", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super("conflict", message);
  }
}

const envelope = (code: ErrorCode, message: string, details?: unknown): ErrorEnvelope => ({
  error: { code, message, details },
});

export const errorPlugin = new Elysia({ name: "errors" })
  .error({ APP: AppError })
  .onError({ as: "scoped" }, ({ code, error, status }) => {
    if (error instanceof AppError) {
      return status(error.status, envelope(error.code, error.message, error.details));
    }
    if (code === "VALIDATION") {
      const details = error.all.map((issue) => ({ path: issue.path, message: issue.message }));
      return status(422, envelope("validation", "Invalid request", details));
    }
    if (code === "NOT_FOUND") {
      return status(404, envelope("not_found", "Not found"));
    }
    return status(500, envelope("internal", "Internal server error"));
  });
