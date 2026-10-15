import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { recipeStore } from "@/lib/recipes/store";
import {
  validateUptimeTargets,
  validateNotificationChannel,
  UptimeMonitorTarget,
  UptimeNotificationChannel,
} from "@/lib/recipes/types";
import { uptimeOrchestrator } from "@/lib/recipes/uptime-kuma";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function POST(req: Request, context: RouteContext) {
  try {
    // 1. Authentication check
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(context.params);
    const recipeId = resolvedParams.id;

    // 2. Ownership check
    const recipe = await recipeStore.getRecipeById(user.id, recipeId);
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    if (recipe.type !== "uptime") {
      return NextResponse.json(
        { error: "Recipe is not an uptime monitor." },
        { status: 400 }
      );
    }

    // 3. Payload parsing & validation
    let body: {
      targets?: UptimeMonitorTarget[];
      notification?: UptimeNotificationChannel;
    } = {};

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (body.targets) {
      const targetsVal = validateUptimeTargets(body.targets);
      if (!targetsVal.valid) {
        return NextResponse.json(
          { error: targetsVal.error || "Invalid monitored websites." },
          { status: 400 }
        );
      }
    }

    if (body.notification) {
      const notifVal = validateNotificationChannel(
        body.notification.type,
        body.notification.target
      );
      if (!notifVal.valid) {
        return NextResponse.json(
          { error: notifVal.error || "Invalid alert notification destination." },
          { status: 400 }
        );
      }
    }

    // 4. Update via orchestrator
    const updatedMetadata = await uptimeOrchestrator.update(
      user.id,
      recipe.metadata || {},
      {
        targets: body.targets,
        notification: body.notification,
      }
    );

    // 5. Persist updated metadata in store
    const updatedRecipe = await recipeStore.updateRecipe(
      user.id,
      recipeId,
      {
        metadata: updatedMetadata as unknown as Record<string, unknown>,
      }
    );

    return NextResponse.json({ success: true, recipe: updatedRecipe }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in POST /api/recipes/uptime/[id]/update:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
