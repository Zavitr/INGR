import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    },
  );
}

/**
 * Administrative server client using SUPABASE_SERVICE_ROLE_KEY.
 * Used exclusively for server-side store mutations, webhook event logging,
 * and billing synchronization that bypasses client RLS restrictions.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase credentials not configured.");
  }

  return createServerClient(supabaseUrl, serviceKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
}

export const DEFAULT_INSTANCE_USER: User = {
  id: "00000000-0000-0000-0000-000000000001",
  app_metadata: { provider: "email", providers: ["email"], plan: "pro" },
  user_metadata: { name: "Instance Owner", plan: "pro" },
  aud: "authenticated",
  confirmation_sent_at: "",
  recovery_sent_at: "",
  email_change_sent_at: "",
  new_email: "",
  invited_at: "",
  action_link: "",
  email: "owner@ingr.local",
  phone: "",
  created_at: "2026-01-01T00:00:00.000Z",
  confirmed_at: "2026-01-01T00:00:00.000Z",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  phone_confirmed_at: "",
  last_sign_in_at: "2026-01-01T00:00:00.000Z",
  role: "authenticated",
  updated_at: "2026-01-01T00:00:00.000Z",
  identities: [],
  is_anonymous: false,
};

/**
 * Helper to retrieve authenticated user from request Authorization header
 * (Bearer token) or from session cookies. In open-source mode, returns DEFAULT_INSTANCE_USER.
 */
export async function getAuthenticatedUser(req?: Request): Promise<User | null> {
  try {
    const supabase = await createClient();

    // 1. Check Authorization: Bearer <token>
    const authHeader = req?.headers.get("authorization") || req?.headers.get("Authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.substring(7).trim();
      if (!token) return null;
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return null;
      }
      return data.user;
    }

    // 2. Check session from request cookies
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      return data.user;
    }

    // 3. Fallback to instance owner in open-source single-tenant mode
    return DEFAULT_INSTANCE_USER;
  } catch (err) {
    console.error("Error authenticating user:", err);
    return DEFAULT_INSTANCE_USER;
  }
}
