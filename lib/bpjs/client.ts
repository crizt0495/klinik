import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bpjsSettings } from "@/db/schema";
import type { BpjsConnection, BpjsProvider } from "./types";
import { BpjsApiError } from "./types";
import { VClaimProvider } from "./vclaim";
import { createMockProvider, isMockConnection } from "./mock";

/**
 * Resolves the BPJS connection for an organization.
 *
 * Precedence (highest first): environment variables → organization settings →
 * defaults. The database row can be maintained via the "Pengaturan BPJS" page;
 * environment overrides let production deployments inject credentials without
 * storing them in the database:
 *
 *   BPJS_ENABLED, BPJS_MOCK, BPJS_BASE_URL, BPJS_CONS_ID, BPJS_SECRET_KEY,
 *   BPJS_USER_KEY, BPJS_FASKES_CODE, BPJS_FASKES_NAME
 */
export async function loadBpjsConnection(organizationId: string): Promise<BpjsConnection> {
  const rows = await db()
    .select()
    .from(bpjsSettings)
    .where(eq(bpjsSettings.organizationId, organizationId))
    .limit(1);
  const row = rows[0];

  const env = {
    consId: process.env.BPJS_CONS_ID ?? "",
    secretKey: process.env.BPJS_SECRET_KEY ?? "",
    userKey: process.env.BPJS_USER_KEY ?? "",
    baseUrl: process.env.BPJS_BASE_URL ?? "",
    faskesCode: process.env.BPJS_FASKES_CODE ?? "",
    faskesName: process.env.BPJS_FASKES_NAME ?? "",
    mock: process.env.BPJS_MOCK ? process.env.BPJS_MOCK !== "false" : undefined,
    enabled: process.env.BPJS_ENABLED ? process.env.BPJS_ENABLED === "true" : undefined,
  };

  const mockMode = env.mock ?? row?.mockMode ?? true;
  const enabled = env.enabled ?? row?.enabled ?? false;

  const managedByEnv =
    env.mock !== undefined ||
    env.enabled !== undefined ||
    Boolean(env.consId || env.secretKey || env.userKey || env.baseUrl || env.faskesCode || env.faskesName);

  return {
    managedByEnv,
    enabled,
    mockMode,
    serviceBaseUrl: env.baseUrl || row?.serviceBaseUrl || null,
    consId: env.consId || row?.consId || "",
    secretKey: env.secretKey || row?.secretKey || "",
    userKey: env.userKey || row?.userKey || "",
    faskesCode: env.faskesCode || row?.faskesCode || null,
    faskesName: env.faskesName || row?.faskesName || null,
  };
}

export async function createBpjsProvider(organizationId: string): Promise<BpjsProvider> {
  const connection = await loadBpjsConnection(organizationId);
  return providerFromConnection(connection);
}

export function providerFromConnection(connection: BpjsConnection): BpjsProvider {
  if (isMockConnection(connection)) {
    return createMockProvider();
  }
  if (!connection.serviceBaseUrl) {
    throw new BpjsApiError("CONFIG", "URL layanan BPJS belum dikonfigurasi. Lengkapi pengaturan BPJS.");
  }
  return new VClaimProvider(connection);
}

export { isMockConnection };

export async function saveBpjsSettings(organizationId: string, input: Partial<BpjsConnection>): Promise<void> {
  const existing = await db().select({ id: bpjsSettings.id }).from(bpjsSettings).where(eq(bpjsSettings.organizationId, organizationId)).limit(1);

  const patch: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.mockMode !== undefined) patch.mockMode = input.mockMode;
  if (input.consId !== undefined) patch.consId = input.consId;
  if (input.secretKey !== undefined) patch.secretKey = input.secretKey;
  if (input.userKey !== undefined) patch.userKey = input.userKey;
  if (input.serviceBaseUrl !== undefined) patch.serviceBaseUrl = input.serviceBaseUrl;
  if (input.faskesCode !== undefined) patch.faskesCode = input.faskesCode;
  if (input.faskesName !== undefined) patch.faskesName = input.faskesName;

  if (existing.length > 0) {
    await db().update(bpjsSettings).set(patch).where(eq(bpjsSettings.id, existing[0].id));
  } else {
    await db()
      .insert(bpjsSettings)
      .values({
        organizationId,
        enabled: input.enabled ?? false,
        mockMode: input.mockMode ?? true,
        serviceBaseUrl: input.serviceBaseUrl ?? null,
        consId: input.consId ?? "",
        secretKey: input.secretKey ?? "",
        userKey: input.userKey ?? "",
        faskesCode: input.faskesCode ?? null,
        faskesName: input.faskesName ?? null,
      });
  }
}