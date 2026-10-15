import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { recipeStore } from "@/lib/recipes/store";
import { uptimeOrchestrator } from "@/lib/recipes/uptime-kuma";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(req: Request, context: RouteContext) {
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

    // 3. Retrieve stats from orchestrator
    const stats = await uptimeOrchestrator.getStats(recipe.metadata || {});

    return NextResponse.json(
      {
        success: true,
        recipeId: recipe.id,
        status: recipe.status,
        statusPageUrl: recipe.liveUrl,
        stats,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error in GET /api/recipes/uptime/[id]/status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
