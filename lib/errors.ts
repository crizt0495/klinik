export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_STATE"
  | "INSUFFICIENT_STOCK"
  | "DUPLICATE_RECORD"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Data tidak valid", details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, 400, details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Tidak terautentikasi") {
    super("UNAUTHORIZED", message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Akses ditolak") {
    super("FORBIDDEN", message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Data tidak ditemukan") {
    super("NOT_FOUND", message, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Terjadi konflik data") {
    super("CONFLICT", message, 409);
    this.name = "ConflictError";
  }
}

export class InvalidStateError extends AppError {
  constructor(message = "Status tidak valid untuk operasi ini") {
    super("INVALID_STATE", message, 409);
    this.name = "InvalidStateError";
  }
}

export class InsufficientStockError extends AppError {
  constructor(message = "Stok tidak mencukupi") {
    super("INSUFFICIENT_STOCK", message, 409);
    this.name = "InsufficientStockError";
  }
}

export class DuplicateRecordError extends AppError {
  constructor(message = "Data sudah ada") {
    super("DUPLICATE_RECORD", message, 409);
    this.name = "DuplicateRecordError";
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Terlalu banyak percobaan. Silakan coba lagi nanti.") {
    super("RATE_LIMITED", message, 429);
    this.name = "RateLimitedError";
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error) {
    return new AppError("INTERNAL_ERROR", err.message, 500);
  }
  return new AppError("INTERNAL_ERROR", "Terjadi kesalahan internal", 500);
}

export function formatZodError(error: unknown): Record<string, unknown> {
  if (error && typeof error === "object" && "errors" in error) {
    const zodErr = error as { errors?: Array<{ path: (string | number)[]; message: string }> };
    const details: Record<string, unknown> = {};
    for (const e of zodErr.errors ?? []) {
      const key = e.path.join(".");
      details[key] = e.message;
    }
    return details;
  }
  return {};
}