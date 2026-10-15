import { createClient, DEFAULT_INSTANCE_USER } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Plus, Zap } from "lucide-react";
import Link from "next/link";
import { recipeStore } from "@/lib/recipes/store";
import { getUserPlan } from "@/lib/recipes/types";
import { RecipeList } from "@/components/recipes/recipe-list";

export default async function RecipesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user || DEFAULT_INSTANCE_USER;

  if (!user) {
    redirect("/auth/login");
  }

  const recipes = await recipeStore.listRecipes(user.id);
  const activeCount = await recipeStore.countActive(user.id);
  const plan = getUserPlan(user, activeCount, "pro");

  return (
    <div className="w-full max-w-7xl p-5 md:p-10 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recipes</h1>
          <p className="text-muted-foreground mt-1">Manage your active recipes and live websites.</p>
        </div>
        <Link 
          href="/protected/recipes/new" 
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm"
        >
          <Plus className="mr-2 h-4 w-4" /> New Recipe
        </Link>
      </div>

      {recipes.length > 0 ? (
        <RecipeList
          initialRecipes={recipes}
          initialActiveCount={activeCount}
          initialPlan={plan}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center flex flex-col items-center mt-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6">
            <Zap size={32} />
          </div>
          <h3 className="text-xl font-semibold mb-2">No active recipes</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            You haven&apos;t activated any recipes yet. Pick a recipe from the library to get started.
          </p>
          
          <Link 
            href="/protected/recipes/new" 
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Browse Library
          </Link>
        </div>
      )}
    </div>
  );
}
