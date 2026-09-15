import { pgTable, uuid, varchar, text, date, time, integer, index, uniqueIndex, timestamp } from "drizzle-orm/pg-core";
import { organizations, branches, users } from "./core";
import { patients, doctors, departments, rooms } from "./clinical";

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    patientId: uuid("patient_id").notNull().references(() => patients.id),
    doctorId: uuid("doctor_id").notNull().references(() => doctors.id),
    departmentId: uuid("department_id").notNull().references(() => departments.id),
    roomId: uuid("room_id").references(() => rooms.id),
    appointmentNumber: varchar("appointment_number", { length: 32 }).notNull(),
    appointmentDate: date("appointment_date").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    appointmentType: varchar("appointment_type", { length: 64 }).notNull().default("REGULAR"),
    status: varchar("status", { length: 32 }).notNull().default("SCHEDULED"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("appointments_org_number_idx").on(t.organizationId, t.appointmentNumber),
    index("appointments_org_date_idx").on(t.organizationId, t.appointmentDate),
    index("appointments_patient_idx").on(t.patientId),
    index("appointments_doctor_date_idx").on(t.doctorId, t.appointmentDate),
    index("appointments_org_branch_idx").on(t.organizationId, t.branchId),
    index("appointments_status_idx").on(t.status),
  ],
);

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    patientId: uuid("patient_id").notNull().references(() => patients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    doctorId: uuid("doctor_id").notNull().references(() => doctors.id),
    departmentId: uuid("department_id").notNull().references(() => departments.id),
    visitNumber: varchar("visit_number", { length: 32 }).notNull(),
    visitDate: date("visit_date").notNull(),
    visitType: varchar("visit_type", { length: 32 }).notNull().default("REGISTRATION"),
    status: varchar("status", { length: 32 }).notNull().default("CHECKED_IN"),
    chiefComplaint: text("chief_complaint"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("visits_org_number_idx").on(t.organizationId, t.visitNumber),
    index("visits_patient_idx").on(t.patientId),
    index("visits_doctor_date_idx").on(t.doctorId, t.visitDate),
    index("visits_org_branch_date_idx").on(t.organizationId, t.branchId, t.visitDate),
    index("visits_appointment_idx").on(t.appointmentId),
    index("visits_status_idx").on(t.status),
  ],
);

export const queues = pgTable(
  "queues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    departmentId: uuid("department_id").notNull().references(() => departments.id),
    patientId: uuid("patient_id").notNull().references(() => patients.id),
    visitId: uuid("visit_id").references(() => visits.id),
    queueDate: date("queue_date").notNull(),
    queueNumber: integer("queue_number").notNull(),
    queueCode: varchar("queue_code", { length: 16 }).notNull(),
    priority: varchar("priority", { length: 16 }).notNull().default("NORMAL"),
    status: varchar("status", { length: 32 }).notNull().default("WAITING"),
    calledAt: timestamp("called_at", { withTimezone: true }),
    servedAt: timestamp("served_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("queues_org_branch_dept_date_num_idx").on(t.organizationId, t.branchId, t.departmentId, t.queueDate, t.queueNumber),
    index("queues_org_branch_date_idx").on(t.organizationId, t.branchId, t.queueDate),
    index("queues_dept_status_idx").on(t.departmentId, t.status),
    index("queues_patient_idx").on(t.patientId),
    index("queues_visit_idx").on(t.visitId),
  ],
);

export const vitalSigns = pgTable(
  "vital_signs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    visitId: uuid("visit_id").notNull().references(() => visits.id),
    temperature: varchar("temperature", { length: 16 }),
    systolic: integer("systolic"),
    diastolic: integer("diastolic"),
    heartRate: integer("heart_rate"),
    respiratoryRate: integer("respiratory_rate"),
    oxygenSaturation: varchar("oxygen_saturation", { length: 16 }),
    weight: varchar("weight", { length: 16 }),
    height: varchar("height", { length: 16 }),
    bmi: varchar("bmi", { length: 16 }),
    painScale: integer("pain_scale"),
    notes: text("notes"),
    recordedBy: uuid("recorded_by").references(() => users.id),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("vital_signs_visit_idx").on(t.visitId)],
);