import { db } from "@/db";
import { settings } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

const DEFAULT_SETTINGS: Record<string, unknown> = {
  clinic_name: "Klinik Sehat",
  clinic_logo: null,
  invoice_prefix: "INV",
  patient_number_prefix: "MR",
  appointment_prefix: "APT",
  queue_prefix: "A",
  visit_prefix: "REG",
  prescription_prefix: "RX",
  purchase_order_prefix: "PO",
  goods_receipt_prefix: "GR",
  payment_prefix: "PAY",
  refund_prefix: "REF",
  lab_order_prefix: "LAB",
  rad_order_prefix: "RAD",
  opname_prefix: "SO",
  timezone: "Asia/Jakarta",
  currency: "IDR",
  tax_enabled: false,
  tax_rate: 0,
  receipt_footer: "Terima kasih telah mempercayakan kesehatan Anda kepada kami.",
};

export class SettingsService {
  private cache = new Map<string, Record<string, unknown>>();

  async getForOrg(organizationId: string): Promise<Record<string, unknown>> {
    const key = organizationId;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const rows = await db().select().from(settings).where(and(eq(settings.organizationId, organizationId), isNull(settings.branchId)));
    const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      merged[row.key] = row.value;
    }
    this.cache.set(key, merged);
    return merged;
  }

  async getBranchPrefixed(organizationId: string): Promise<Record<string, unknown>> {
    return this.getForOrg(organizationId);
  }

  async upsert(organizationId: string, branchId: string | null, key: string, value: unknown): Promise<void> {
    const existing = await db()
      .select({ id: settings.id })
      .from(settings)
      .where(and(eq(settings.organizationId, organizationId), branchId ? eq(settings.branchId, branchId) : isNull(settings.branchId), eq(settings.key, key)))
      .limit(1);
    if (existing.length > 0) {
      await db().update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.id, existing[0].id));
    } else {
      await db().insert(settings).values({ organizationId, branchId: branchId ?? null, key, value });
    }
    this.cache.delete(organizationId);
  }
}

export const settingsService = new SettingsService();