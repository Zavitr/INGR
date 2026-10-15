-- Phase 5 Billing and Security Hardening Schema

-- 1. Extend recipes table with is_public (n8n-style public templates)
ALTER TABLE IF EXISTS public.recipes 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- Create index on is_public for public template queries
CREATE INDEX IF NOT EXISTS idx_recipes_is_public ON public.recipes(is_public) WHERE is_public = true;

-- 2. Hardened RLS policies on recipes table:
-- Drop existing open client-write policies to prevent direct client quota bypassing
DROP POLICY IF EXISTS "Users can insert their own recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can update their own recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can delete their own recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can view their own recipes" ON public.recipes;

-- Client SELECT policy: Users can view their own recipes OR public community templates
CREATE POLICY "Users can view own or public recipes"
  ON public.recipes
  FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

-- Client INSERT/UPDATE/DELETE are intentionally restricted to service_role or server API routes.
-- Only server routes with verified service role or validated server sessions can mutate recipes,
-- preventing direct Supabase client bypass of plan limits.

-- 3. Billing Accounts Table
CREATE TABLE IF NOT EXISTS public.billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid', 'trialing')),
  current_period_end TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_user_id ON public.billing_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_accounts_stripe_customer ON public.billing_accounts(stripe_customer_id);

-- Enable RLS on billing_accounts
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;

-- Users can only read their own billing account
CREATE POLICY "Users can view their own billing account"
  ON public.billing_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

-- No client writes allowed to billing_accounts (strictly server / webhook service_role)

-- 4. Stripe Events Table (Idempotent Webhook Processing)
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id TEXT PRIMARY KEY, -- Stripe Event ID (e.g., evt_12345)
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB NOT NULL
);

-- RLS: Service role only, no public or client access
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
