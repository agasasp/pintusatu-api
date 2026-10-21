import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ==========================================
// ENUMS
// ==========================================
export const userRoleEnum = pgEnum("user_role", [
  "superadmin",
  "owner",
  "penjaga",
  "tenant",
]);

export const electricityModeEnum = pgEnum("electricity_mode", [
  "token",
  "meter",
  "flat",
]);

export const electricityModeOverrideEnum = pgEnum("electricity_mode_override", [
  "default",
  "token",
  "meter",
  "flat",
]);

export const roomStatusEnum = pgEnum("room_status", [
  "available",
  "occupied",
  "maintenance",
  "reserved",
]);

export const identityTypeEnum = pgEnum("identity_type", [
  "ktp",
  "sim",
  "passport",
]);

export const tenantStatusEnum = pgEnum("tenant_status", [
  "active",
  "inactive",
  "blacklisted",
]);

export const paymentTermEnum = pgEnum("payment_term", [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
]);

export const leaseStatusEnum = pgEnum("lease_status", [
  "active",
  "terminated",
  "pending",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "unpaid",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "bank_transfer",
  "qris",
  "cash",
  "va",
  "midtrans",
  "xendit",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "approved",
  "rejected",
]);

export const taskTypeEnum = pgEnum("task_type", [
  "housekeeping",
  "maintenance",
  "inspection",
  "asset_service",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "completed",
  "verified",
]);

export const financeTypeEnum = pgEnum("finance_type", [
  "income",
  "expense",
]);

export const financeCategoryEnum = pgEnum("finance_category", [
  "rental_income",
  "electricity_income",
  "deposit_income",
  "other_income",
  "cleaning_supplies",
  "asset_maintenance",
  "staff_salary",
  "electricity_utility",
  "water_utility",
  "wifi_utility",
  "petty_cash",
  "tax_license",
  "other_expense",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "starter",
  "pro",
  "enterprise",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "suspended",
  "trial",
  "past_due",
]);

export const webhookStatusEnum = pgEnum("webhook_status", [
  "received",
  "processed",
  "failed",
]);

// ==========================================
// TABLES
// ==========================================

// 1. Users
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: userRoleEnum("role").default("owner").notNull(),
  phone: varchar("phone", { length: 50 }),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").default(true).notNull(),
  ownerId: uuid("owner_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 2. Branches (Kost Properties)
export const branches = pgTable("branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  address: text("address").notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  province: varchar("province", { length: 100 }).notNull(),
  postalCode: varchar("postal_code", { length: 20 }),
  coordinates: varchar("coordinates", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  electricityBillingMode: electricityModeEnum("electricity_billing_mode").default("meter").notNull(),
  kwhRate: decimal("kwh_rate", { precision: 12, scale: 2 }).default("2000.00").notNull(),
  kwhAdminFee: decimal("kwh_admin_fee", { precision: 12, scale: 2 }).default("15000.00").notNull(),
  rules: text("rules"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 3. Staff Assignments
export const staffAssignments = pgTable("staff_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  staffId: uuid("staff_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }).notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
});

// 4. Rooms
export const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }).notNull(),
  roomNumber: varchar("room_number", { length: 50 }).notNull(),
  floor: integer("floor").default(1).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  basePrice: decimal("base_price", { precision: 12, scale: 2 }).notNull(),
  dailyPrice: decimal("daily_price", { precision: 12, scale: 2 }),
  depositAmount: decimal("deposit_amount", { precision: 12, scale: 2 }).default("500000.00").notNull(),
  status: roomStatusEnum("status").default("available").notNull(),
  facilities: text("facilities"), // JSON stringified array of facility names
  meterInitial: decimal("meter_initial", { precision: 10, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 5. Tenants
export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }).notNull(),
  identityType: identityTypeEnum("identity_type").default("ktp").notNull(),
  identityNumber: varchar("identity_number", { length: 100 }).notNull(),
  identityPhotoUrl: text("identity_photo_url"),
  emergencyContactName: varchar("emergency_contact_name", { length: 255 }),
  emergencyContactPhone: varchar("emergency_contact_phone", { length: 50 }),
  emergencyContactRelation: varchar("emergency_contact_relation", { length: 100 }),
  occupation: varchar("occupation", { length: 100 }),
  status: tenantStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 6. Leases
export const leases = pgTable("leases", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").references(() => rooms.id, { onDelete: "cascade" }).notNull(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }).notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  rentPrice: decimal("rent_price", { precision: 12, scale: 2 }).notNull(),
  depositPaid: decimal("deposit_paid", { precision: 12, scale: 2 }).default("0.00").notNull(),
  billingCycleDay: integer("billing_cycle_day").default(1).notNull(),
  paymentTerm: paymentTermEnum("payment_term").default("monthly").notNull(),
  electricityBillingModeOverride: electricityModeOverrideEnum("electricity_billing_mode_override").default("default").notNull(),
  status: leaseStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 7. Electricity Readings & Logs
export const electricityReadings = pgTable("electricity_readings", {
  id: uuid("id").defaultRandom().primaryKey(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }).notNull(),
  roomId: uuid("room_id").references(() => rooms.id, { onDelete: "cascade" }).notNull(),
  leaseId: uuid("lease_id").references(() => leases.id, { onDelete: "set null" }),
  recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
  periodMonth: integer("period_month").notNull(), // 1 - 12
  periodYear: integer("period_year").notNull(),   // e.g. 2026
  mode: electricityModeEnum("mode").notNull(),
  previousReading: decimal("previous_reading", { precision: 10, scale: 2 }).default("0.00").notNull(),
  currentReading: decimal("current_reading", { precision: 10, scale: 2 }).default("0.00").notNull(),
  kwhUsed: decimal("kwh_used", { precision: 10, scale: 2 }).default("0.00").notNull(),
  kwhRate: decimal("kwh_rate", { precision: 12, scale: 2 }).default("0.00").notNull(),
  adminFee: decimal("admin_fee", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  tokenCode: varchar("token_code", { length: 100 }),
  meterPhotoUrl: text("meter_photo_url"),
  isBilled: boolean("is_billed").default(false).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 8. Invoices
export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull().unique(),
  leaseId: uuid("lease_id").references(() => leases.id, { onDelete: "set null" }),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  roomId: uuid("room_id").references(() => rooms.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }).notNull(),
  amountRent: decimal("amount_rent", { precision: 12, scale: 2 }).default("0.00").notNull(),
  amountElectricity: decimal("amount_electricity", { precision: 12, scale: 2 }).default("0.00").notNull(),
  amountPenalty: decimal("amount_penalty", { precision: 12, scale: 2 }).default("0.00").notNull(),
  amountOther: decimal("amount_other", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  remainingAmount: decimal("remaining_amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  status: invoiceStatusEnum("status").default("unpaid").notNull(),
  penaltyAppliedAt: timestamp("penalty_applied_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 9. Payments
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  paymentNumber: varchar("payment_number", { length: 100 }).notNull().unique(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  proofUrl: text("proof_url"),
  status: paymentStatusEnum("status").default("pending").notNull(),
  gatewayTransactionId: varchar("gateway_transaction_id", { length: 255 }),
  verifiedBy: uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 10. Housekeeping & Asset Tasks
export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }).notNull(),
  roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  taskType: taskTypeEnum("task_type").notNull(),
  priority: taskPriorityEnum("priority").default("medium").notNull(),
  status: taskStatusEnum("status").default("todo").notNull(),
  beforePhotoUrl: text("before_photo_url"),
  afterPhotoUrl: text("after_photo_url"),
  cost: decimal("cost", { precision: 12, scale: 2 }).default("0.00").notNull(),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 11. Finance Transactions (Petty Cash & NOI)
export const financeTransactions = pgTable("finance_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  category: financeCategoryEnum("category").notNull(),
  type: financeTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  transactionDate: timestamp("transaction_date", { withTimezone: true }).defaultNow().notNull(),
  receiptUrl: text("receipt_url"),
  description: text("description").notNull(),
  approvalStatus: approvalStatusEnum("approval_status").default("approved").notNull(),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 12. SaaS Subscriptions (Superadmin Multi-Tenant Billing & MRR)
export const saasSubscriptions = pgTable("saas_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  planName: subscriptionPlanEnum("plan_name").default("starter").notNull(),
  roomQuota: integer("room_quota").default(20).notNull(),
  pricePerMonth: decimal("price_per_month", { precision: 12, scale: 2 }).default("150000.00").notNull(),
  status: subscriptionStatusEnum("status").default("trial").notNull(),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  isSuspended: boolean("is_suspended").default(false).notNull(),
  suspensionReason: text("suspension_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 13. Webhook Logs
export const webhookLogs = pgTable("webhook_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: varchar("provider", { length: 100 }).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  payload: text("payload").notNull(),
  status: webhookStatusEnum("status").default("received").notNull(),
  responseMessage: text("response_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// DRIZZLE RELATIONS
// ==========================================

export const usersRelations = relations(users, ({ many }) => ({
  branches: many(branches),
  staffAssignments: many(staffAssignments),
  tenants: many(tenants),
  assignedTasks: many(tasks, { relationName: "assignedTasks" }),
  createdTasks: many(tasks, { relationName: "createdTasks" }),
  financeTransactions: many(financeTransactions),
  saasSubscriptions: many(saasSubscriptions),
}));

export const branchesRelations = relations(branches, ({ one, many }) => ({
  owner: one(users, {
    fields: [branches.ownerId],
    references: [users.id],
  }),
  rooms: many(rooms),
  staffAssignments: many(staffAssignments),
  leases: many(leases),
  electricityReadings: many(electricityReadings),
  invoices: many(invoices),
  tasks: many(tasks),
  financeTransactions: many(financeTransactions),
}));

export const staffAssignmentsRelations = relations(staffAssignments, ({ one }) => ({
  staff: one(users, {
    fields: [staffAssignments.staffId],
    references: [users.id],
  }),
  branch: one(branches, {
    fields: [staffAssignments.branchId],
    references: [branches.id],
  }),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  branch: one(branches, {
    fields: [rooms.branchId],
    references: [branches.id],
  }),
  leases: many(leases),
  electricityReadings: many(electricityReadings),
  invoices: many(invoices),
  tasks: many(tasks),
}));

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  owner: one(users, {
    fields: [tenants.ownerId],
    references: [users.id],
  }),
  user: one(users, {
    fields: [tenants.userId],
    references: [users.id],
  }),
  leases: many(leases),
  invoices: many(invoices),
}));

export const leasesRelations = relations(leases, ({ one, many }) => ({
  room: one(rooms, {
    fields: [leases.roomId],
    references: [rooms.id],
  }),
  tenant: one(tenants, {
    fields: [leases.tenantId],
    references: [tenants.id],
  }),
  branch: one(branches, {
    fields: [leases.branchId],
    references: [branches.id],
  }),
  electricityReadings: many(electricityReadings),
  invoices: many(invoices),
}));

export const electricityReadingsRelations = relations(electricityReadings, ({ one }) => ({
  branch: one(branches, {
    fields: [electricityReadings.branchId],
    references: [branches.id],
  }),
  room: one(rooms, {
    fields: [electricityReadings.roomId],
    references: [rooms.id],
  }),
  lease: one(leases, {
    fields: [electricityReadings.leaseId],
    references: [leases.id],
  }),
  recorder: one(users, {
    fields: [electricityReadings.recordedBy],
    references: [users.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  lease: one(leases, {
    fields: [invoices.leaseId],
    references: [leases.id],
  }),
  tenant: one(tenants, {
    fields: [invoices.tenantId],
    references: [tenants.id],
  }),
  room: one(rooms, {
    fields: [invoices.roomId],
    references: [rooms.id],
  }),
  branch: one(branches, {
    fields: [invoices.branchId],
    references: [branches.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  verifier: one(users, {
    fields: [payments.verifiedBy],
    references: [users.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  branch: one(branches, {
    fields: [tasks.branchId],
    references: [branches.id],
  }),
  room: one(rooms, {
    fields: [tasks.roomId],
    references: [rooms.id],
  }),
  assignee: one(users, {
    fields: [tasks.assignedTo],
    references: [users.id],
    relationName: "assignedTasks",
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "createdTasks",
  }),
}));

export const financeTransactionsRelations = relations(financeTransactions, ({ one }) => ({
  branch: one(branches, {
    fields: [financeTransactions.branchId],
    references: [branches.id],
  }),
  user: one(users, {
    fields: [financeTransactions.userId],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [financeTransactions.approvedBy],
    references: [users.id],
  }),
}));

export const saasSubscriptionsRelations = relations(saasSubscriptions, ({ one }) => ({
  owner: one(users, {
    fields: [saasSubscriptions.ownerId],
    references: [users.id],
  }),
}));

// ==========================================
// TYPE DEFINITIONS
// ==========================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type Lease = typeof leases.$inferSelect;
export type NewLease = typeof leases.$inferInsert;

export type ElectricityReading = typeof electricityReadings.$inferSelect;
export type NewElectricityReading = typeof electricityReadings.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type FinanceTransaction = typeof financeTransactions.$inferSelect;
export type NewFinanceTransaction = typeof financeTransactions.$inferInsert;

export type SaasSubscription = typeof saasSubscriptions.$inferSelect;
export type NewSaasSubscription = typeof saasSubscriptions.$inferInsert;

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;
