import { createClient, DEFAULT_INSTANCE_USER } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { User, Key } from "lucide-react";
import { BillingSection } from "./billing-section";
import { getBillingAccount } from "@/lib/stripe/client";
import { recipeStore } from "@/lib/recipes/store";
import { listAppConnections } from "@/lib/activepieces/client";
import { getUserPlan } from "@/lib/recipes/types";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user || DEFAULT_INSTANCE_USER;

  if (!user) {
    redirect("/auth/login");
  }

  // Retrieve billing account and quotas
  const billing = await getBillingAccount(user.id);
  const activeRecipesCount = await recipeStore.countActive(user.id);
  const plan = getUserPlan(user, activeRecipesCount, billing.plan, billing.graceEndsAt);

  // Retrieve connected services count
  let connectedServicesCount = 0;
  try {
    const connections = await listAppConnections(user.id);
    connectedServicesCount = connections.filter(
      (c) => c.status === "ACTIVE" && c.externalId.includes(`_${user.id}_`)
    ).length;
  } catch {
    // Graceful fallback
  }

  return (
    <div className="w-full max-w-4xl p-5 md:p-10 flex flex-col gap-8 mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Manage your personal account details, credentials, and plan.
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Profile Information</h2>
              <p className="text-xs text-muted-foreground">Your account identification</p>
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Address</label>
              <div className="text-sm font-medium mt-1">{user.email}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">User ID</label>
              <div className="text-xs font-mono text-muted-foreground mt-1">{user.id}</div>
            </div>
          </div>
        </div>

        {/* Plan & Billing */}
        {/* Tier status: Free Plan (2 active recipes, 3 connected services) or Pro Plan ($7/mo) */}
        <BillingSection
          plan={plan.tier}
          activeRecipesCount={activeRecipesCount}
          maxRecipes={plan.maxActiveRecipes}
          connectedServicesCount={connectedServicesCount}
          maxServices={plan.maxConnectedServices}
          isGracePeriod={plan.isGracePeriod}
          graceEndsAt={plan.graceEndsAt}
        />

        {/* Security & Vault */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Key size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Security & Encryption</h2>
              <p className="text-xs text-muted-foreground">Automated vault protection</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            All your connected service credentials (Supabase, Cloudflare, Oracle, etc.) are encrypted at rest using AES-256 in your private engine vault.
          </p>
        </div>
      </div>
    </div>
  );
}
