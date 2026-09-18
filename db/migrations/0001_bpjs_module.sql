CREATE TABLE "bpjs_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"visit_id" uuid,
	"invoice_id" uuid,
	"sep_id" uuid,
	"claim_number" varchar(64) NOT NULL,
	"no_sep" varchar(32),
	"no_kartu" varchar(32),
	"nama_peserta" varchar(255),
	"tgl_pelayanan" date,
	"tgl_pulang" date,
	"jenis_pelayanan" varchar(32) DEFAULT 'RAWAT_JALAN' NOT NULL,
	"diagnosa" varchar(32),
	"detail_diagnosa" varchar(64),
	"jumlah_beban_biaya" varchar(32) DEFAULT '0' NOT NULL,
	"jumlah_tagihan" varchar(32) DEFAULT '0' NOT NULL,
	"total_by_40" varchar(32) DEFAULT '0' NOT NULL,
	"total_by_south" varchar(32) DEFAULT '0' NOT NULL,
	"ttl_by_group" varchar(32) DEFAULT '0' NOT NULL,
	"group_by_json" jsonb,
	"response_json" jsonb,
	"status" varchar(32) DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"submitted_by" uuid,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bpjs_eligibility_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"user_id" uuid,
	"check_type" varchar(32) NOT NULL,
	"lookup_value" varchar(255) NOT NULL,
	"birth_date" date,
	"status" varchar(32) DEFAULT 'SUCCESS' NOT NULL,
	"no_kartu" varchar(32),
	"nik" varchar(32),
	"nama" varchar(255),
	"tgl_lahir" date,
	"jns_peserta" varchar(255),
	"hak_kelas" varchar(32),
	"penjamin" varchar(255),
	"no_mr" varchar(32),
	"status_peserta" varchar(255),
	"response_json" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bpjs_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"patient_id" uuid,
	"no_rujukan" varchar(64) NOT NULL,
	"jenis_rujukan" varchar(16),
	"jenis_pelayanan" varchar(16),
	"tgl_kunjungan" date,
	"tgl_rujukan" date,
	"tgl_akhir_rujukan" date,
	"no_kartu" varchar(32),
	"nik" varchar(32),
	"nama_peserta" varchar(255),
	"asal_faskes_kode" varchar(32),
	"asal_faskes_nama" varchar(255),
	"poli_rujukan_kode" varchar(32),
	"poli_rujukan_nama" varchar(255),
	"diagnosa_kode" varchar(32),
	"diagnosa_nama" varchar(255),
	"catatan" text,
	"status" varchar(32) DEFAULT 'ACTIVE' NOT NULL,
	"source" varchar(32) DEFAULT 'VCLAIM' NOT NULL,
	"response_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bpjs_sep" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"branch_id" uuid,
	"visit_id" uuid,
	"patient_insurance_id" uuid,
	"insurance_provider_id" uuid,
	"no_sep" varchar(32),
	"no_kartu" varchar(32) NOT NULL,
	"nik" varchar(32),
	"nama" varchar(255) NOT NULL,
	"tgl_lahir" date,
	"gender" varchar(8),
	"tgl_sep" date NOT NULL,
	"jns_pelayanan" varchar(32) DEFAULT '1' NOT NULL,
	"asal_rujukan" varchar(32) DEFAULT '4' NOT NULL,
	"no_rujukan" varchar(64),
	"tgl_rujukan" date,
	"ppk_rujukan" varchar(64),
	"poli_tujuan" varchar(64),
	"poli_eksekutif" varchar(64) DEFAULT '0' NOT NULL,
	"klas_rawat_hak" varchar(16),
	"klas_rawat_naik" varchar(16),
	"pembiayaan" varchar(16),
	"penanggung_pembiayaan" varchar(16),
	"no_mr" varchar(32),
	"diagnosa" varchar(32),
	"cob" varchar(16) DEFAULT '0' NOT NULL,
	"katarak" varchar(16) DEFAULT '0' NOT NULL,
	"laka_lantas" varchar(16) DEFAULT '0' NOT NULL,
	"cp_cob" varchar(16),
	"tujuan_kunj" varchar(16) DEFAULT '0' NOT NULL,
	"user" varchar(64),
	"catatan" text,
	"status_submit" varchar(32) DEFAULT 'INSERTED' NOT NULL,
	"meta_json" jsonb,
	"status" varchar(32) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bpjs_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"mock_mode" boolean DEFAULT true NOT NULL,
	"service_base_url" varchar(512),
	"cons_id" varchar(64),
	"secret_key" varchar(255),
	"user_key" varchar(128),
	"faskes_code" varchar(32),
	"faskes_name" varchar(255),
	"last_tested_at" timestamp with time zone,
	"last_test_status" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bpjs_claims" ADD CONSTRAINT "bpjs_claims_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_claims" ADD CONSTRAINT "bpjs_claims_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_claims" ADD CONSTRAINT "bpjs_claims_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_claims" ADD CONSTRAINT "bpjs_claims_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_claims" ADD CONSTRAINT "bpjs_claims_sep_id_bpjs_sep_id_fk" FOREIGN KEY ("sep_id") REFERENCES "public"."bpjs_sep"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_claims" ADD CONSTRAINT "bpjs_claims_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_eligibility_checks" ADD CONSTRAINT "bpjs_eligibility_checks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_eligibility_checks" ADD CONSTRAINT "bpjs_eligibility_checks_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_eligibility_checks" ADD CONSTRAINT "bpjs_eligibility_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_referrals" ADD CONSTRAINT "bpjs_referrals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_referrals" ADD CONSTRAINT "bpjs_referrals_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_referrals" ADD CONSTRAINT "bpjs_referrals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_sep" ADD CONSTRAINT "bpjs_sep_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_sep" ADD CONSTRAINT "bpjs_sep_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_sep" ADD CONSTRAINT "bpjs_sep_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_sep" ADD CONSTRAINT "bpjs_sep_patient_insurance_id_patient_insurances_id_fk" FOREIGN KEY ("patient_insurance_id") REFERENCES "public"."patient_insurances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_sep" ADD CONSTRAINT "bpjs_sep_insurance_provider_id_insurance_providers_id_fk" FOREIGN KEY ("insurance_provider_id") REFERENCES "public"."insurance_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bpjs_settings" ADD CONSTRAINT "bpjs_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bpjs_claims_org_number_idx" ON "bpjs_claims" USING btree ("organization_id","claim_number");--> statement-breakpoint
CREATE INDEX "bpjs_claims_org_created_idx" ON "bpjs_claims" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "bpjs_claims_visit_idx" ON "bpjs_claims" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "bpjs_claims_status_idx" ON "bpjs_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bpjs_eligibility_checks_org_idx" ON "bpjs_eligibility_checks" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "bpjs_eligibility_checks_nokartu_idx" ON "bpjs_eligibility_checks" USING btree ("no_kartu");--> statement-breakpoint
CREATE INDEX "bpjs_eligibility_checks_nik_idx" ON "bpjs_eligibility_checks" USING btree ("nik");--> statement-breakpoint
CREATE UNIQUE INDEX "bpjs_referrals_org_no_idx" ON "bpjs_referrals" USING btree ("organization_id","no_rujukan");--> statement-breakpoint
CREATE INDEX "bpjs_referrals_org_created_idx" ON "bpjs_referrals" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "bpjs_referrals_nokartu_idx" ON "bpjs_referrals" USING btree ("no_kartu");--> statement-breakpoint
CREATE INDEX "bpjs_referrals_status_idx" ON "bpjs_referrals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "bpjs_sep_org_nokartu_nosep_idx" ON "bpjs_sep" USING btree ("organization_id","no_kartu","no_sep");--> statement-breakpoint
CREATE INDEX "bpjs_sep_org_created_idx" ON "bpjs_sep" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "bpjs_sep_visit_idx" ON "bpjs_sep" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "bpjs_sep_status_idx" ON "bpjs_sep" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "bpjs_settings_org_idx" ON "bpjs_settings" USING btree ("organization_id");