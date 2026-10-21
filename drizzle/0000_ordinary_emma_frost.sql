CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."electricity_mode" AS ENUM('token', 'meter', 'flat');--> statement-breakpoint
CREATE TYPE "public"."electricity_mode_override" AS ENUM('default', 'token', 'meter', 'flat');--> statement-breakpoint
CREATE TYPE "public"."finance_category" AS ENUM('rental_income', 'electricity_income', 'deposit_income', 'other_income', 'cleaning_supplies', 'asset_maintenance', 'staff_salary', 'electricity_utility', 'water_utility', 'wifi_utility', 'petty_cash', 'tax_license', 'other_expense');--> statement-breakpoint
CREATE TYPE "public"."finance_type" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."identity_type" AS ENUM('ktp', 'sim', 'passport');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lease_status" AS ENUM('active', 'terminated', 'pending');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('bank_transfer', 'qris', 'cash', 'va', 'midtrans', 'xendit');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."payment_term" AS ENUM('monthly', 'quarterly', 'semi_annual', 'annual');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('available', 'occupied', 'maintenance', 'reserved');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('starter', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'suspended', 'trial', 'past_due');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'completed', 'verified');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('housekeeping', 'maintenance', 'inspection', 'asset_service');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'inactive', 'blacklisted');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('superadmin', 'owner', 'penjaga', 'tenant');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('received', 'processed', 'failed');--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"address" text NOT NULL,
	"city" varchar(100) NOT NULL,
	"province" varchar(100) NOT NULL,
	"postal_code" varchar(20),
	"coordinates" varchar(100),
	"phone" varchar(50),
	"electricity_billing_mode" "electricity_mode" DEFAULT 'meter' NOT NULL,
	"kwh_rate" numeric(12, 2) DEFAULT '2000.00' NOT NULL,
	"kwh_admin_fee" numeric(12, 2) DEFAULT '15000.00' NOT NULL,
	"rules" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "electricity_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"lease_id" uuid,
	"recorded_by" uuid,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"mode" "electricity_mode" NOT NULL,
	"previous_reading" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"current_reading" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"kwh_used" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"kwh_rate" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"admin_fee" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"token_code" varchar(100),
	"meter_photo_url" text,
	"is_billed" boolean DEFAULT false NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"approved_by" uuid,
	"category" "finance_category" NOT NULL,
	"type" "finance_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"transaction_date" timestamp with time zone DEFAULT now() NOT NULL,
	"receipt_url" text,
	"description" text NOT NULL,
	"approval_status" "approval_status" DEFAULT 'approved' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar(100) NOT NULL,
	"lease_id" uuid,
	"tenant_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"amount_rent" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"amount_electricity" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"amount_penalty" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"amount_other" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"remaining_amount" numeric(12, 2) NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"status" "invoice_status" DEFAULT 'unpaid' NOT NULL,
	"penalty_applied_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"rent_price" numeric(12, 2) NOT NULL,
	"deposit_paid" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"billing_cycle_day" integer DEFAULT 1 NOT NULL,
	"payment_term" "payment_term" DEFAULT 'monthly' NOT NULL,
	"electricity_billing_mode_override" "electricity_mode_override" DEFAULT 'default' NOT NULL,
	"status" "lease_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"payment_number" varchar(100) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"proof_url" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"gateway_transaction_id" varchar(255),
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_payment_number_unique" UNIQUE("payment_number")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"room_number" varchar(50) NOT NULL,
	"floor" integer DEFAULT 1 NOT NULL,
	"type" varchar(100) NOT NULL,
	"base_price" numeric(12, 2) NOT NULL,
	"daily_price" numeric(12, 2),
	"deposit_amount" numeric(12, 2) DEFAULT '500000.00' NOT NULL,
	"status" "room_status" DEFAULT 'available' NOT NULL,
	"facilities" text,
	"meter_initial" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"plan_name" "subscription_plan" DEFAULT 'starter' NOT NULL,
	"room_quota" integer DEFAULT 20 NOT NULL,
	"price_per_month" numeric(12, 2) DEFAULT '150000.00' NOT NULL,
	"status" "subscription_status" DEFAULT 'trial' NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"suspension_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"room_id" uuid,
	"assigned_to" uuid,
	"created_by" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"task_type" "task_type" NOT NULL,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"before_photo_url" text,
	"after_photo_url" text,
	"cost" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"scheduled_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"owner_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50) NOT NULL,
	"identity_type" "identity_type" DEFAULT 'ktp' NOT NULL,
	"identity_number" varchar(100) NOT NULL,
	"identity_photo_url" text,
	"emergency_contact_name" varchar(255),
	"emergency_contact_phone" varchar(50),
	"emergency_contact_relation" varchar(100),
	"occupation" varchar(100),
	"status" "tenant_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'owner' NOT NULL,
	"phone" varchar(50),
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(100) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" text NOT NULL,
	"status" "webhook_status" DEFAULT 'received' NOT NULL,
	"response_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electricity_readings" ADD CONSTRAINT "electricity_readings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electricity_readings" ADD CONSTRAINT "electricity_readings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electricity_readings" ADD CONSTRAINT "electricity_readings_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electricity_readings" ADD CONSTRAINT "electricity_readings_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;