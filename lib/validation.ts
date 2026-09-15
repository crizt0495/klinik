import type { z } from "zod/v4";
import { ValidationError, formatZodError } from "@/lib/errors";

export function parseZod<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ValidationError("Data tidak valid", formatZodError(parsed.error));
  }
  return parsed.data;
}
