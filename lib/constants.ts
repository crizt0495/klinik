export const APPOINTMENT_STATUS = ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[number];

export const QUEUE_STATUS = ["WAITING", "CALLED", "SERVING", "COMPLETED", "SKIPPED", "CANCELLED"] as const;
export type QueueStatus = (typeof QUEUE_STATUS)[number];

export const VISIT_STATUS = ["CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type VisitStatus = (typeof VISIT_STATUS)[number];

export const MEDICAL_RECORD_STATUS = ["DRAFT", "FINALIZED", "AMENDED"] as const;
export type MedicalRecordStatus = (typeof MEDICAL_RECORD_STATUS)[number];

export const PRESCRIPTION_STATUS = ["DRAFT", "ISSUED", "PARTIALLY_DISPENSED", "DISPENSED", "CANCELLED"] as const;
export type PrescriptionStatus = (typeof PRESCRIPTION_STATUS)[number];

export const PRESCRIPTION_ITEM_STATUS = ["PENDING", "PARTIAL", "DISPENSED", "CANCELLED"] as const;
export type PrescriptionItemStatus = (typeof PRESCRIPTION_ITEM_STATUS)[number];

export const INVOICE_STATUS = ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOID", "REFUNDED", "PARTIALLY_REFUNDED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

export const PAYMENT_STATUS = ["PENDING", "COMPLETED", "VOID", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const PAYMENT_METHOD = ["CASH", "DEBIT", "CREDIT_CARD", "BANK_TRANSFER", "QRIS", "INSURANCE", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[number];

export const REFUND_STATUS = ["REQUESTED", "APPROVED", "PROCESSED", "REJECTED", "CANCELLED"] as const;
export type RefundStatus = (typeof REFUND_STATUS)[number];

export const INVENTORY_TRANSACTION_TYPE = [
  "PURCHASE_RECEIPT",
  "SALE",
  "DISPENSE",
  "RETURN",
  "ADJUSTMENT",
  "STOCK_OPNAME",
  "EXPIRED",
  "DAMAGED",
  "TRANSFER_IN",
  "TRANSFER_OUT",
] as const;
export type InventoryTransactionType = (typeof INVENTORY_TRANSACTION_TYPE)[number];

export const PO_STATUS = ["DRAFT", "SUBMITTED", "APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"] as const;
export type PurchaseOrderStatus = (typeof PO_STATUS)[number];

export const GOODS_RECEIPT_STATUS = ["DRAFT", "FINALIZED", "CANCELLED"] as const;
export type GoodsReceiptStatus = (typeof GOODS_RECEIPT_STATUS)[number];

export const STOCK_OPNAME_STATUS = ["DRAFT", "COUNTING", "SUBMITTED", "APPROVED", "CANCELLED"] as const;
export type StockOpnameStatus = (typeof STOCK_OPNAME_STATUS)[number];

export const LAB_ORDER_STATUS = ["ORDERED", "COLLECTED", "PROCESSING", "COMPLETED", "VERIFIED", "CANCELLED"] as const;
export type LabOrderStatus = (typeof LAB_ORDER_STATUS)[number];

export const RAD_ORDER_STATUS = ["ORDERED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "VERIFIED", "CANCELLED"] as const;
export type RadOrderStatus = (typeof RAD_ORDER_STATUS)[number];

export const BATCH_STATUS = ["ACTIVE", "EXPIRED", "DEPLETED", "SUSPENDED"] as const;
export type BatchStatus = (typeof BATCH_STATUS)[number];

export const ORGANIZATION_STATUS = ["ACTIVE", "SUSPENDED", "INACTIVE"] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUS)[number];

export const PATIENT_STATUS = ["ACTIVE", "INACTIVE"] as const;
export type PatientStatus = (typeof PATIENT_STATUS)[number];

export const GENDER = ["MALE", "FEMALE"] as const;
export type Gender = (typeof GENDER)[number];

export const STATUS_LABEL: Record<string, string> = {
  WAITING: "Menunggu",
  CALLED: "Dipanggil",
  SERVING: "Dilayani",
  COMPLETED: "Selesai",
  SKIPPED: "Dilewati",
  CANCELLED: "Dibatalkan",
  SCHEDULED: "Terjadwal",
  CONFIRMED: "Dikonfirmasi",
  CHECKED_IN: "Check-in",
  IN_PROGRESS: "Berlangsung",
  NO_SHOW: "Tidak Hadir",
  DRAFT: "Draf",
  FINALIZED: "Difinalisasi",
  AMENDED: "Diamandemen",
  ISSUED: "Diterbitkan",
  PARTIALLY_DISPENSED: "Sebagian Diserahkan",
  DISPENSED: "Diserahkan",
  PENDING: "Tertunda",
  PARTIAL: "Sebagian",
  PAID: "Lunas",
  PARTIALLY_PAID: "Sebagian Dibayar",
  VOID: "Batal",
  REFUNDED: "Dikembalikan",
  PARTIALLY_REFUNDED: "Sebagian Dikembalikan",
  REQUESTED: "Diminta",
  APPROVED: "Disetujui",
  PROCESSED: "Diproses",
  REJECTED: "Ditolak",
  SUBMITTED: "Diajukan",
  RECEIVED: "Diterima",
  PARTIALLY_RECEIVED: "Sebagian Diterima",
  COUNTING: "Penghitungan",
  ORDERED: "Dipesan",
  COLLECTED: "Diambil",
  PROCESSING: "Diproses",
  VERIFIED: "Terverifikasi",
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
  SUSPENDED: "Ditangguhkan",
};

export const BADGE_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  ACTIVE: "success",
  COMPLETED: "success",
  PAID: "success",
  VERIFIED: "success",
  DISPENSED: "success",
  SERVING: "success",
  PROCESSED: "success",
  FINALIZED: "success",
  APPROVED: "success",
  CONFIRMED: "success",
  CHECKED_IN: "success",
  RECEIVED: "success",

  WAITING: "warning",
  PENDING: "warning",
  SCHEDULED: "warning",
  DRAFT: "warning",
  ISSUED: "warning",
  PARTIALLY_PAID: "warning",
  PARTIALLY_DISPENSED: "warning",
  PARTIALLY_RECEIVED: "warning",
  SUBMITTED: "warning",
  COUNTING: "warning",
  ORDERED: "warning",
  COLLECTED: "warning",
  PROCESSING: "warning",
  IN_PROGRESS: "warning",
  REQUESTED: "warning",
  PARTIALLY_REFUNDED: "warning",
  AMENDED: "warning",

  CANCELLED: "destructive",
  VOID: "destructive",
  REJECTED: "destructive",
  NO_SHOW: "destructive",
  EXPIRED: "destructive",
  SUSPENDED: "destructive",
  INACTIVE: "destructive",
  SKIPPED: "secondary",

  CALLED: "default",
  FULL: "default",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Tunai",
  DEBIT: "Debit",
  CREDIT_CARD: "Kartu Kredit",
  BANK_TRANSFER: "Transfer Bank",
  QRIS: "QRIS",
  INSURANCE: "Asuransi",
  OTHER: "Lainnya",
};

export const PRIORITY_LABEL: Record<string, string> = {
  NORMAL: "Normal",
  PRIORITY: "Prioritas",
  EMERGENCY: "Gawat",
};