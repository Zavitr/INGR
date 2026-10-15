-- Phase 3 Recipe Schema
-- Schema for managing user recipes (e.g. Free Website Hosting via Cloudflare Pages)

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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON public.recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_user_status ON public.recipes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_recipes_subdomain ON public.recipes(subdomain);

-- Row Level Security (RLS)
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recipes"
  ON public.recipes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recipes"
  ON public.recipes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipes"
  ON public.recipes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipes"
  ON public.recipes
  FOR DELETE
  USING (auth.uid() = user_id);
