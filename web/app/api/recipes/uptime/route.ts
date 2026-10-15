import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { recipeStore } from "@/lib/recipes/store";
import {
  getUserPlan,
  validateSubdomain,
  validateUptimeTargets,
  validateNotificationChannel,
  UptimeMonitorTarget,
  UptimeNotificationChannel,
} from "@/lib/recipes/types";
import { uptimeOrchestrator } from "@/lib/recipes/uptime-kuma";
import { getBillingAccount } from "@/lib/stripe/client";

export async function POST(req: Request) {
  try {
    // 1. Authentication check
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Compute Connection check (Oracle Cloud or test mode fallback)
    const isTestMode =
      (process.env.NODE_ENV !== "production" &&
        (process.env.TEST_MODE === "true" ||
          process.env.NODE_ENV === "test" ||
          process.env.HERMETIC_DEPLOYMENT === "true"));

    const hasOracle = await uptimeOrchestrator.checkComputeConnection(user.id);
    if (!hasOracle && !isTestMode) {
      return NextResponse.json(
        {
          error: "Please connect your Oracle Cloud account before setting up uptime monitoring.",
          code: "ORACLE_NOT_CONNECTED",
        },
        { status: 400 }
      );
    }

    // 3. Plan limit enforcement
    const billing = await getBillingAccount(user.id);
    const activeCount = await recipeStore.countActive(user.id);
    const plan = getUserPlan(user, activeCount, billing.plan, billing.graceEndsAt);
    if (plan.tier === "free" && activeCount >= plan.maxActiveRecipes) {
      return NextResponse.json(
        {
          error:
            "Free plan limit reached (maximum 2 active recipes). Upgrade to Pro for unlimited recipes, or deactivate an existing recipe.",
          code: "PLAN_LIMIT_EXCEEDED",
        },
        { status: 403 }
      );
    }

    // 4. Payload validation
    let body: {
      name?: string;
      subdomain?: string;
      isPublic?: boolean;
      targets?: UptimeMonitorTarget[];
      notification?: UptimeNotificationChannel;
    } = {};

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const subdomain = typeof body.subdomain === "string" ? body.subdomain.trim() : "";
    const isPublic = Boolean(body.isPublic);
    const targets = Array.isArray(body.targets) ? body.targets : [];
    const notification = body.notification;

    if (!subdomain) {
      return NextResponse.json(
        { error: "Web address (subdomain) is required for the public status page." },
        { status: 400 }
      );
    }

    const domainValidation = validateSubdomain(subdomain);
    if (!domainValidation.valid) {
      return NextResponse.json(
        { error: domainValidation.error || "Invalid web address format." },
        { status: 400 }
      );
    }

    const targetsValidation = validateUptimeTargets(targets);
    if (!targetsValidation.valid) {
      return NextResponse.json(
        { error: targetsValidation.error || "Invalid website monitoring specification." },
        { status: 400 }
      );
    }

    if (!notification || typeof notification !== "object") {
      return NextResponse.json(
        { error: "Alert notification settings are required." },
        { status: 400 }
      );
    }

    const notifValidation = validateNotificationChannel(notification.type, notification.target);
    if (!notifValidation.valid) {
      return NextResponse.json(
        { error: notifValidation.error || "Invalid alert notification destination." },
        { status: 400 }
      );
    }

    // 5. Reserve recipe slot synchronously to prevent TOCTOU race conditions
    let recipe = await recipeStore.createRecipe({
      userId: user.id,
      type: "uptime",
      name: name || `${subdomain} Status`,
      status: "deploying",
      subdomain,
      liveUrl: `https://${subdomain}.status.ingr.local`,
      services: ["oracle"],
      isPublic,
      metadata: { targetsCount: targets.length },
    });

    // 6. Provisioning
    let provisionResult;
    try {
      provisionResult = await uptimeOrchestrator.provision(user.id, {
        name: name || `${subdomain} Status`,
        subdomain,
        targets,
        notification,
      });

      const updated = await recipeStore.updateRecipe(user.id, recipe.id, {
        status: "active",
        liveUrl: provisionResult.statusPageUrl,
        metadata: provisionResult.metadata as unknown as Record<string, unknown>,
      });
      if (updated) {
        recipe = updated;
      }
    } catch (provisionError) {
      console.error("Uptime provisioning failed:", provisionError);
      // Mark as error so it doesn't consume an active quota slot
      await recipeStore.updateRecipe(user.id, recipe.id, {
        status: "error",
        metadata: {
          error:
            provisionError instanceof Error ? provisionError.message : "Provisioning failed",
        },
      });

      return NextResponse.json(
        {
          error:
            provisionError instanceof Error
              ? provisionError.message
              : "Failed to set up uptime monitoring.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        recipe,
        statusPageUrl: provisionResult.statusPageUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/recipes/uptime:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
