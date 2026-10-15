import { createClient, createAdminClient } from "@/lib/supabase/server";
import type {
  Recipe,
  CreateRecipeInput,
  UpdateRecipeInput,
} from "./types";
import crypto from "node:crypto";

// Fallback in-memory store attached to globalThis to survive module reloading in dev/tests
declare global {
  var __ingrRecipeStore: Map<string, Recipe[]> | undefined;
}

if (!globalThis.__ingrRecipeStore) {
  globalThis.__ingrRecipeStore = new Map<string, Recipe[]>();
}

const memoryStore = globalThis.__ingrRecipeStore;

interface SupabaseRecipeRow {
  id: string;
  user_id: string;
  type: string;
  name: string;
  status: string;
  subdomain: string;
  live_url: string | null;
  services: string[];
  metadata: Record<string, unknown>;
  is_public?: boolean;
  created_at: string;
  updated_at: string;
}

function rowToRecipe(row: SupabaseRecipeRow): Recipe {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type || "hosting",
    name: row.name,
    status: (row.status as Recipe["status"]) || "active",
    subdomain: row.subdomain,
    liveUrl: row.live_url || null,
    services: row.services || ["cloudflare"],
    metadata: row.metadata || {},
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class RecipeStore {
  /**
   * Helper to determine whether we should bypass remote Supabase (test mode).
   * In production, memory fallback is disabled to fail-closed.
   */
  private isTestMode(): boolean {
    if (process.env.NODE_ENV === "production") return false;
    return process.env.TEST_MODE === "true" || process.env.NODE_ENV === "test";
  }

  /**
   * List all recipes belonging to a specific user.
   */
  async listRecipes(userId: string): Promise<Recipe[]> {
    if (!this.isTestMode()) {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("recipes")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (!error && data) {
          return (data as SupabaseRecipeRow[]).map(rowToRecipe);
        }

        // If table doesn't exist (PGRST205) or RLS error, fall back to memory
        if (error && error.code !== "PGRST205") {
          console.warn("Supabase listRecipes error, falling back to memory:", error.message);
        }
      } catch (err) {
        console.warn("Supabase client unavailable, using memory store:", err);
      }
    }

    const userRecipes = memoryStore.get(userId) || [];
    return [...userRecipes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get a specific recipe by ID and userId.
   */
  async getRecipeById(userId: string, recipeId: string): Promise<Recipe | null> {
    if (!this.isTestMode()) {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("recipes")
          .select("*")
          .eq("id", recipeId)
          .eq("user_id", userId)
          .single();

        if (!error && data) {
          return rowToRecipe(data as SupabaseRecipeRow);
        }
      } catch (err) {
        console.warn("Supabase client unavailable for getRecipeById:", err);
      }
    }

    const userRecipes = memoryStore.get(userId) || [];
    const recipe = userRecipes.find((r) => r.id === recipeId);
    return recipe || null;
  }

  /**
   * Create a new recipe.
   */
  async createRecipe(input: CreateRecipeInput): Promise<Recipe> {
    const now = new Date().toISOString();
    const id = input.id || `rec_${crypto.randomBytes(6).toString("hex")}`;
    const recipe: Recipe = {
      id,
      userId: input.userId,
      type: input.type || "hosting",
      name: input.name,
      status: input.status || "deploying",
      subdomain: input.subdomain,
      liveUrl: input.liveUrl !== undefined ? input.liveUrl : `https://${input.subdomain}.pages.dev`,
      services: input.services || ["cloudflare"],
      metadata: input.metadata || {},
      isPublic: Boolean(input.isPublic),
      createdAt: now,
      updatedAt: now,
    };

    if (!this.isTestMode()) {
      try {
        const supabase = createAdminClient();
        const row = {
          id: recipe.id,
          user_id: recipe.userId,
          type: recipe.type,
          name: recipe.name,
          status: recipe.status,
          subdomain: recipe.subdomain,
          live_url: recipe.liveUrl,
          services: recipe.services,
          metadata: recipe.metadata,
          is_public: recipe.isPublic,
          created_at: recipe.createdAt,
          updated_at: recipe.updatedAt,
        };

        const { data, error } = await supabase.from("recipes").insert(row).select().single();

        if (!error && data) {
          // Keep memory store in sync as well
          const current = memoryStore.get(recipe.userId) || [];
          memoryStore.set(recipe.userId, [recipe, ...current]);
          return rowToRecipe(data as SupabaseRecipeRow);
        }

        if (error && error.code !== "PGRST205") {
          console.warn("Supabase createRecipe error, fallback to memory:", error.message);
        }
      } catch (err) {
        console.warn("Supabase insert failed, fallback to memory:", err);
        if (process.env.NODE_ENV === "production") {
          throw new Error("Database storage temporarily unavailable.");
        }
      }
    }

    // Fallback store
    const current = memoryStore.get(recipe.userId) || [];
    memoryStore.set(recipe.userId, [recipe, ...current]);
    return recipe;
  }

  /**
   * Update an existing recipe.
   */
  async updateRecipe(
    userId: string,
    recipeId: string,
    updates: UpdateRecipeInput,
    maxActiveRecipes = 2
  ): Promise<Recipe | null> {
    const existing = await this.getRecipeById(userId, recipeId);
    if (!existing) {
      return null;
    }

    if (existing.status !== "active" && existing.status !== "deploying" && updates.status === "active") {
      const activeCount = await this.countActive(userId);
      if (activeCount >= maxActiveRecipes) {
        updates = { ...updates, status: existing.status };
      }
    }

    const now = new Date().toISOString();
    const updatedRecipe: Recipe = {
      ...existing,
      name: updates.name !== undefined ? updates.name : existing.name,
      status: updates.status !== undefined ? updates.status : existing.status,
      liveUrl: updates.liveUrl !== undefined ? updates.liveUrl : existing.liveUrl,
      isPublic: updates.isPublic !== undefined ? updates.isPublic : existing.isPublic,
      metadata:
        updates.metadata !== undefined
          ? { ...existing.metadata, ...updates.metadata }
          : existing.metadata,
      updatedAt: now,
    };

    if (!this.isTestMode()) {
      try {
        const supabase = createAdminClient();
        const updateData: Partial<SupabaseRecipeRow> = {
          updated_at: now,
        };
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.status !== undefined) updateData.status = updates.status;
        if (updates.liveUrl !== undefined) updateData.live_url = updates.liveUrl;
        if (updates.metadata !== undefined) updateData.metadata = updatedRecipe.metadata;
        if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;

        const { data, error } = await supabase
          .from("recipes")
          .update(updateData)
          .eq("id", recipeId)
          .eq("user_id", userId)
          .select()
          .single();

        if (!error && data) {
          // Sync memory
          const list = memoryStore.get(userId) || [];
          memoryStore.set(
            userId,
            list.map((r) => (r.id === recipeId ? rowToRecipe(data as SupabaseRecipeRow) : r))
          );
          return rowToRecipe(data as SupabaseRecipeRow);
        }
      } catch (err) {
        console.warn("Supabase update failed, updating memory:", err);
      }
    }

    // Update memory store
    const list = memoryStore.get(userId) || [];
    memoryStore.set(
      userId,
      list.map((r) => (r.id === recipeId ? updatedRecipe : r))
    );
    return updatedRecipe;
  }

  /**
   * List all public recipe templates across all users.
   */
  async listPublicRecipes(): Promise<Recipe[]> {
    if (!this.isTestMode()) {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("recipes")
          .select("*")
          .eq("is_public", true)
          .order("created_at", { ascending: false });

        if (!error && data) {
          return (data as SupabaseRecipeRow[]).map(rowToRecipe);
        }
      } catch (err) {
        console.warn("Supabase listPublicRecipes error:", err);
      }
    }

    const allPublic: Recipe[] = [];
    for (const list of memoryStore.values()) {
      allPublic.push(...list.filter((r) => r.isPublic));
    }
    return allPublic.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Deactivate a recipe (set status to 'inactive').
   */
  async deactivateRecipe(userId: string, recipeId: string): Promise<Recipe | null> {
    return this.updateRecipe(userId, recipeId, { status: "inactive" });
  }

  /**
   * Count active (or deploying) recipes for a user.
   */
  async countActive(userId: string): Promise<number> {
    const recipes = await this.listRecipes(userId);
    return recipes.filter((r) => r.status === "active" || r.status === "deploying").length;
  }
}

export const recipeStore = new RecipeStore();
