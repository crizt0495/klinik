import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
  inet,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
export const tstz = ts;

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    legalName: varchar("legal_name", { length: 255 }),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Jakarta"),
    currency: varchar("currency", { length: 8 }).notNull().default("IDR"),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("organizations_code_idx").on(t.code),
    index("organizations_status_idx").on(t.status),
  ],
);

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    address: text("address"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Jakarta"),
    status: varchar("status", { length: 32 }).notNull().default("ACTIVE"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("branches_org_code_idx").on(t.organizationId, t.code),
    index("branches_org_idx").on(t.organizationId),
    index("branches_status_idx").on(t.status),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    branchId: uuid("branch_id").references(() => branches.id),
    username: varchar("username", { length: 64 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 32 }),
    avatarUrl: text("avatar_url"),
    isActive: boolean("is_active").notNull().default(true),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    lastLoginAt: ts("last_login_at"),
    passwordChangedAt: ts("password_changed_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    uniqueIndex("users_org_username_ci_idx").on(t.organizationId, t.username),
    index("users_org_idx").on(t.organizationId),
    index("users_branch_idx").on(t.branchId),
    index("users_active_idx").on(t.isActive),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    organizationId: uuid("organization_id").notNull(),
    branchId: uuid("branch_id"),
    expiresAt: ts("expires_at").notNull(),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    revokedAt: ts("revoked_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_idx").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("roles_org_code_idx").on(t.organizationId, t.code),
    index("roles_org_idx").on(t.organizationId),
  ],
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 128 }).notNull(),
    module: varchar("module", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("permissions_code_idx").on(t.code)],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] }), index("user_roles_role_idx").on(t.roleId)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const counters = pgTable(
  "counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    branchId: uuid("branch_id"),
    scope: varchar("scope", { length: 128 }).notNull(),
    period: varchar("period", { length: 16 }),
    sequence: integer("sequence").notNull().default(0),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("counters_scope_idx").on(t.organizationId, t.branchId, t.scope, t.period),
  ],
);

export const settings = pgTable(
  "settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    branchId: uuid("branch_id"),
    key: varchar("key", { length: 128 }).notNull(),
    value: jsonb("value").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("settings_org_key_idx").on(t.organizationId, t.branchId, t.key),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    branchId: uuid("branch_id"),
    userId: uuid("user_id"),
    action: varchar("action", { length: 128 }).notNull(),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: uuid("entity_id"),
    oldData: jsonb("old_data"),
    newData: jsonb("new_data"),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_org_created_idx").on(t.organizationId, t.createdAt),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_user_idx").on(t.userId),
    index("audit_logs_action_idx").on(t.action),
  ],
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    branchId: uuid("branch_id"),
    userId: uuid("user_id"),
    action: varchar("action", { length: 128 }).notNull(),
    entityType: varchar("entity_type", { length: 64 }),
    entityId: uuid("entity_id"),
    meta: jsonb("meta"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("activity_logs_org_created_idx").on(t.organizationId, t.createdAt),
    index("activity_logs_user_idx").on(t.userId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    branchId: uuid("branch_id"),
    userId: uuid("user_id").notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message"),
    data: jsonb("data"),
    readAt: ts("read_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_read_idx").on(t.userId, t.readAt),
    index("notifications_org_idx").on(t.organizationId),
  ],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 64 }).notNull(),
    ipAddress: inet("ip_address").notNull(),
    successful: boolean("successful").notNull(),
    attemptedAt: ts("attempted_at").notNull().defaultNow(),
  },
  (t) => [index("login_attempts_username_idx").on(t.username, t.attemptedAt), index("login_attempts_ip_idx").on(t.ipAddress, t.attemptedAt)],
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;