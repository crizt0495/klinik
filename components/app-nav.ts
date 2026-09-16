export const NAV_ICON_KEYS = [
  "layout-dashboard",
  "users",
  "calendar-days",
  "list-ordered",
  "stethoscope",
  "file-text",
  "pill",
  "package",
  "truck",
  "flask-conical",
  "scan-line",
  "receipt",
  "wallet",
  "undo-2",
  "shield-check",
  "bar-chart-3",
  "user-cog",
  "settings",
  "history",
  "user-round",
  "door-open",
  "building-2",
  "calendar-clock",
  "package-search",
  "folder-kanban",
] as const;

export type NavIconKey = (typeof NAV_ICON_KEYS)[number];

export interface NavItem {
  title: string;
  href: string;
  icon: NavIconKey;
  permission?: string;
  exact?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export function getNavigation(user: { permissions: Set<string>; isSuperAdmin: boolean }): NavSection[] {
  const can = (p: string) => user.isSuperAdmin || user.permissions.has(p);

  const sections: NavSection[] = [
    {
      title: "Utama",
      items: [{ title: "Dashboard", href: "/dashboard", icon: "layout-dashboard", exact: true }],
    },
    {
      title: "Klinik",
      items: [
        { title: "Pasien", href: "/patients", icon: "users", permission: "patients.view" },
        { title: "Appointment", href: "/appointments", icon: "calendar-days", permission: "appointments.view" },
        { title: "Antrian", href: "/queue", icon: "list-ordered", permission: "queue.view" },
        { title: "Kunjungan", href: "/visits", icon: "stethoscope", permission: "medical_records.view" },
        { title: "Rekam Medis", href: "/medical-records", icon: "file-text", permission: "medical_records.view" },
        { title: "Dokter", href: "/doctors", icon: "user-round", permission: "appointments.view" },
        { title: "Tenaga Medis", href: "/staff", icon: "user-cog", permission: "users.view" },
        { title: "Poli", href: "/departments", icon: "building-2", permission: "settings.view" },
        { title: "Ruangan", href: "/rooms", icon: "door-open", permission: "settings.view" },
        { title: "Jadwal Dokter", href: "/schedules", icon: "calendar-clock", permission: "appointments.view" },
      ],
    },
    {
      title: "Farmasi",
      items: [
        { title: "Resep", href: "/prescriptions", icon: "file-text", permission: "prescriptions.view" },
        { title: "Dispensing", href: "/pharmacy", icon: "pill", permission: "pharmacy.view" },
        { title: "Inventori", href: "/inventory", icon: "package", permission: "inventory.view" },
        { title: "Batch & Kadaluarsa", href: "/inventory/batches", icon: "package-search", permission: "inventory.view" },
        { title: "Stock Opname", href: "/inventory/stock-opname", icon: "folder-kanban", permission: "inventory.opname" },
        { title: "Pembelian", href: "/purchasing", icon: "truck", permission: "purchases.view" },
      ],
    },
    {
      title: "Diagnostik",
      items: [
        { title: "Laboratorium", href: "/laboratory", icon: "flask-conical", permission: "laboratory.view" },
        { title: "Radiologi", href: "/radiology", icon: "scan-line", permission: "radiology.view" },
      ],
    },
    {
      title: "Keuangan",
      items: [
        { title: "Penagihan", href: "/billing", icon: "receipt", permission: "billing.view" },
        { title: "Pembayaran", href: "/payments", icon: "wallet", permission: "payments.view" },
        { title: "Refund", href: "/refunds", icon: "undo-2", permission: "payments.refund" },
        { title: "Asuransi", href: "/insurance", icon: "shield-check", permission: "patients.view" },
      ],
    },
    {
      title: "Laporan",
      items: [{ title: "Laporan", href: "/reports", icon: "bar-chart-3", permission: "reports.view" }],
    },
    {
      title: "Administrasi",
      items: [
        { title: "Pengguna", href: "/users", icon: "users", permission: "users.view" },
        { title: "Peran & Izin", href: "/roles", icon: "shield-check", permission: "roles.view" },
        { title: "Pengaturan", href: "/settings", icon: "settings", permission: "settings.view" },
        { title: "Audit Log", href: "/audit-logs", icon: "history", permission: "audit_logs.view" },
      ],
    },
  ];

  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => item.permission === undefined || can(item.permission)) }))
    .filter((section) => section.items.length > 0);
}