import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { recipeStore } from "@/lib/recipes/store";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(context.params);
    const recipeId = resolvedParams.id;

    const recipe = await recipeStore.getRecipeById(user.id, recipeId);
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    const deactivated = await recipeStore.deactivateRecipe(user.id, recipeId);
    return NextResponse.json({ success: true, recipe: deactivated }, { status: 200 });
  } catch (error) {
    console.error("Error in POST /api/recipes/flow/[id]/deactivate:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
