import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { recipeStore } from "@/lib/recipes/store";
import { getUserPlan } from "@/lib/recipes/types";
import { getBillingAccount } from "@/lib/stripe/client";
import type { FlowNode, FlowConnection, FlowViewMode } from "@/lib/recipes/flow-types";
import crypto from "node:crypto";

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const recipeId = searchParams.get("id");

    if (recipeId) {
      const recipe = await recipeStore.getRecipeById(user.id, recipeId);
      if (!recipe) {
        return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, recipe });
    }

    const billing = await getBillingAccount(user.id);
    const allRecipes = await recipeStore.listRecipes(user.id);
    const activeCount = await recipeStore.countActive(user.id);
    const plan = getUserPlan(user, activeCount, billing.plan, billing.graceEndsAt);

    // Filter flow recipes
    const flowRecipes = allRecipes.filter((r) => r.type === "flow");

    return NextResponse.json({
      success: true,
      recipes: flowRecipes,
      count: flowRecipes.length,
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
    console.error("Failed to fetch flow recipes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch flow recipes" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // 1. Authentication check
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body
    let body: {
      id?: string;
      name?: string;
      description?: string;
      nodes?: FlowNode[];
      connections?: FlowConnection[];
      viewMode?: FlowViewMode;
      status?: "active" | "inactive" | "deploying";
      isPublic?: boolean;
    } = {};

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "Recipe name is required." },
        { status: 400 }
      );
    }

    const nodes = Array.isArray(body.nodes) ? body.nodes : [];
    if (nodes.length === 0) {
      return NextResponse.json(
        { error: "Recipe must contain at least one step node." },
        { status: 400 }
      );
    }

    const connections = Array.isArray(body.connections) ? body.connections : [];
    const status = body.status || "active";

    // 3. Plan quota enforcement
    const billing = await getBillingAccount(user.id);
    const activeCount = await recipeStore.countActive(user.id);
    const plan = getUserPlan(user, activeCount, billing.plan, billing.graceEndsAt);

    // 4. Extract unique connected services
    const serviceSet = new Set<string>();
    for (const node of nodes) {
      if (node.connectorName) {
        serviceSet.add(node.connectorName.replace(/^@activepieces\/piece-/, ""));
      } else if (node.connectorDisplayName) {
        serviceSet.add(node.connectorDisplayName);
      }
    }
    const services = Array.from(serviceSet);

    // 5. If body.id is provided, attempt to update existing recipe
    const existingRecipeId = body.id;
    if (existingRecipeId) {
      const existing = await recipeStore.getRecipeById(user.id, existingRecipeId);
      if (existing) {
        const updatedRecipe = await recipeStore.updateRecipe(
          user.id,
          existingRecipeId,
          {
            name,
            status,
            services: services.length > 0 ? services : existing.services,
            metadata: {
              ...existing.metadata,
              flow: {
                nodes,
                connections,
                viewMode: body.viewMode || "canvas",
                description: body.description || "",
              },
              nodeCount: nodes.length,
              connectionCount: connections.length,
              connectorsList: services,
            },
          },
          plan.maxActiveRecipes
        );

        return NextResponse.json(
          {
            success: true,
            recipe: updatedRecipe,
          },
          { status: 200 }
        );
      }
    }

    // 6. Plan limit for new recipe creation
    if (status === "active" && plan.tier === "free" && activeCount >= plan.maxActiveRecipes) {
      return NextResponse.json(
        {
          error:
            "Free plan limit reached (maximum 2 active recipes). Upgrade to Pro for unlimited recipes, or deactivate an existing recipe.",
          code: "PLAN_LIMIT_EXCEEDED",
        },
        { status: 403 }
      );
    }

    // 7. Generate deterministic valid subdomain slug
    const cleanSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || "custom-flow";
    const randSuffix = crypto.randomBytes(3).toString("hex");
    const subdomain = `${cleanSlug}-${randSuffix}`;

    // 8. Create recipe in recipeStore
    const createdRecipe = await recipeStore.createRecipe({
      userId: user.id,
      type: "flow",
      name,
      status,
      subdomain,
      liveUrl: `https://${subdomain}.pages.dev`,
      services: services.length > 0 ? services : ["universal-connectors"],
      isPublic: Boolean(body.isPublic),
      metadata: {
        flow: {
          nodes,
          connections,
          viewMode: body.viewMode || "canvas",
          description: body.description || "",
        },
        nodeCount: nodes.length,
        connectionCount: connections.length,
        connectorsList: services,
      },
    });

    return NextResponse.json(
      {
        success: true,
        recipe: createdRecipe,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create flow recipe:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create flow recipe" },
      { status: 500 }
    );
  }
}
