"use client";

import { Shield, Sparkles, Check } from "lucide-react";

interface BillingSectionProps {
  plan?: string;
  activeRecipesCount: number;
  maxRecipes?: number;
  connectedServicesCount: number;
  maxServices?: number;
  isGracePeriod?: boolean;
  graceEndsAt?: string | null;
}

export function BillingSection({
  activeRecipesCount,
  connectedServicesCount,
}: BillingSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Shield size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Platform & License</h2>
            <p className="text-xs text-muted-foreground">Open-Source Community Edition</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
          <Sparkles size={12} /> Unlimited
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Active Recipes</div>
          <div className="text-2xl font-bold mt-1 text-foreground">
            {activeRecipesCount}
            <span className="text-xs text-muted-foreground font-normal ml-2">/ Unlimited</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Zero paywalls or recipe creation caps.</p>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Connected Services</div>
          <div className="text-2xl font-bold mt-1 text-foreground">
            {connectedServicesCount}
            <span className="text-xs text-muted-foreground font-normal ml-2">/ Unlimited</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Access to all 4,760+ open connectors.</p>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
        <Check size={14} className="text-emerald-500" />
        <span>100% Free & Open-Source. No subscriptions, trials, or hidden fees.</span>
      </div>
    </div>
  );
}
