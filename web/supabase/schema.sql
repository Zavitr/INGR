-- ==============================================================================
-- INGR Master Supabase Schema: Recipes, Billing, and Security Hardening
-- ==============================================================================

-- 1. Recipes Table
CREATE TABLE IF NOT EXISTS public.recipes (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'hosting',
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'deploying' CHECK (status IN ('deploying', 'active', 'inactive', 'error')),
  subdomain TEXT NOT NULL,
  live_url TEXT,
  services TEXT[] DEFAULT ARRAY['cloudflare']::TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON public.recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_user_status ON public.recipes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_recipes_subdomain ON public.recipes(subdomain);
CREATE INDEX IF NOT EXISTS idx_recipes_is_public ON public.recipes(is_public) WHERE is_public = true;

-- Enable RLS
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DROP POLICY IF EXISTS "Users can insert their own recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can update their own recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can delete their own recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can view their own recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can view own or public recipes" ON public.recipes;

-- Client SELECT policy: Users can view their own recipes OR public community templates
CREATE POLICY "Users can view own or public recipes"
  ON public.recipes
  FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

-- Note: Mutations (INSERT, UPDATE, DELETE) are intentionally restricted to service_role 
-- so server routes enforce billing quotas securely.


-- 2. Billing Accounts Table
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

ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own billing account" ON public.billing_accounts;

CREATE POLICY "Users can view their own billing account"
  ON public.billing_accounts
  FOR SELECT
  USING (auth.uid() = user_id);


-- 3. Stripe Events Table (Idempotent Webhook Processing)
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB NOT NULL
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- Service role only, no public/client policies.
