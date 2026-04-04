-- ZeroToShip Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Create users table first (referenced by other tables)
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"tier" varchar(20) DEFAULT 'free' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

-- Create ideas table (referenced by other tables)
CREATE TABLE IF NOT EXISTS "ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"tagline" text NOT NULL,
	"priority_score" numeric(5, 2) NOT NULL,
	"effort_estimate" varchar(20) NOT NULL,
	"revenue_estimate" text,
	"category" varchar(100),
	"problem_statement" text NOT NULL,
	"target_audience" text,
	"market_size" text,
	"existing_solutions" text,
	"gaps" text,
	"proposed_solution" text,
	"key_features" jsonb DEFAULT '[]'::jsonb,
	"mvp_scope" text,
	"technical_spec" jsonb,
	"business_model" jsonb,
	"go_to_market" jsonb,
	"risks" jsonb DEFAULT '[]'::jsonb,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	"is_published" boolean DEFAULT false NOT NULL
);

-- Create api_keys table
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" varchar(100) NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_unique" UNIQUE("key")
);

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"endpoint" varchar(100) NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp DEFAULT now() NOT NULL,
	"window_end" timestamp NOT NULL
);

-- Create saved_ideas table
CREATE TABLE IF NOT EXISTS "saved_ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"idea_id" uuid NOT NULL,
	"saved_at" timestamp DEFAULT now() NOT NULL
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"plan" varchar(20) DEFAULT 'free' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb,
	"max_effort" varchar(20) DEFAULT 'quarter',
	"email_frequency" varchar(20) DEFAULT 'daily',
	"min_priority_score" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);

-- Create validation_requests table
CREATE TABLE IF NOT EXISTS "validation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"idea_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);

-- Create viewed_ideas table
CREATE TABLE IF NOT EXISTS "viewed_ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"idea_id" uuid NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "api_keys_key_idx" ON "api_keys" ("key");
CREATE INDEX IF NOT EXISTS "ideas_priority_idx" ON "ideas" ("priority_score");
CREATE INDEX IF NOT EXISTS "ideas_published_at_idx" ON "ideas" ("published_at");
CREATE INDEX IF NOT EXISTS "ideas_category_idx" ON "ideas" ("category");
CREATE INDEX IF NOT EXISTS "ideas_effort_idx" ON "ideas" ("effort_estimate");
CREATE INDEX IF NOT EXISTS "rate_limits_identifier_idx" ON "rate_limits" ("identifier");
CREATE INDEX IF NOT EXISTS "rate_limits_window_idx" ON "rate_limits" ("window_end");
CREATE INDEX IF NOT EXISTS "saved_ideas_user_idx" ON "saved_ideas" ("user_id");
CREATE INDEX IF NOT EXISTS "saved_ideas_idea_idx" ON "saved_ideas" ("idea_id");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "viewed_ideas_user_idx" ON "viewed_ideas" ("user_id");
CREATE INDEX IF NOT EXISTS "viewed_ideas_idea_idx" ON "viewed_ideas" ("idea_id");

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "saved_ideas" ADD CONSTRAINT "saved_ideas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "saved_ideas" ADD CONSTRAINT "saved_ideas_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "validation_requests" ADD CONSTRAINT "validation_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "validation_requests" ADD CONSTRAINT "validation_requests_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "viewed_ideas" ADD CONSTRAINT "viewed_ideas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "viewed_ideas" ADD CONSTRAINT "viewed_ideas_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
