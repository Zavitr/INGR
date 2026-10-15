import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { recipeStore } from "@/lib/recipes/store";
import { getUserPlan } from "@/lib/recipes/types";
import { getBillingAccount } from "@/lib/stripe/client";

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const billing = await getBillingAccount(user.id);
    const recipes = await recipeStore.listRecipes(user.id);
    const activeCount = await recipeStore.countActive(user.id);
    const plan = getUserPlan(user, activeCount, billing.plan, billing.graceEndsAt);

    return NextResponse.json({
      recipes,
      activeCount,
      plan: {
        tier: plan.tier,
        maxActiveRecipes: plan.maxActiveRecipes,
        maxConnectedServices: plan.maxConnectedServices,
        canActivateMore: plan.canActivateMore,
        isGracePeriod: plan.isGracePeriod,
        graceEndsAt: plan.graceEndsAt,
      },
    });
  } catch (error) {
    console.error("Failed to fetch recipes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch recipes" },
      { status: 500 }
    );
  }
}
