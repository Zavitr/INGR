import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { recipeStore } from "@/lib/recipes/store";

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

    // 3. Deactivate recipe (set status to 'inactive')
    const deactivatedRecipe = await recipeStore.deactivateRecipe(user.id, recipeId);

    return NextResponse.json({ success: true, recipe: deactivatedRecipe }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in POST /api/recipes/uptime/[id]/deactivate:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
