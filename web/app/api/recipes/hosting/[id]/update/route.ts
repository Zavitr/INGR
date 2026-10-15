import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { getCloudflareApiToken } from "@/lib/activepieces/client";
import { recipeStore } from "@/lib/recipes/store";
import { FilePayload, validateFileBundle, getUserPlan } from "@/lib/recipes/types";
import { deployToCloudflarePages } from "@/lib/recipes/cloudflare-pages";
import { getBillingAccount } from "@/lib/stripe/client";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

async function parseUpdatePayload(req: Request): Promise<{
  files: FilePayload[];
}> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const json = await req.json();
      return {
        files: Array.isArray(json.files) ? json.files : [],
      };
    } catch {
      return { files: [] };
    }
  }

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    try {
      const formData = await req.formData();
      const files: FilePayload[] = [];

      const filesField = formData.get("files");
      if (typeof filesField === "string") {
        try {
          const parsed = JSON.parse(filesField);
          if (Array.isArray(parsed)) {
            files.push(...parsed);
          }
        } catch {
          // ignore
        }
      }

      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          const path = (value as File).name || key;
          const text = await (value as File).text();
          files.push({
            path,
            content: text,
          });
        }
      }

      return { files };
    } catch {
      return { files: [] };
    }
  }

  try {
    const json = await req.json();
    return {
      files: Array.isArray(json.files) ? json.files : [],
    };
  } catch {
    return { files: [] };
  }
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

    // 2. Recipe ownership check
    const recipe = await recipeStore.getRecipeById(user.id, recipeId);
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    // 2.5 Plan limit check if reactivating a non-active recipe (inactive or error)
    const billing = await getBillingAccount(user.id);
    const activeCount = await recipeStore.countActive(user.id);
    const plan = getUserPlan(user, activeCount, billing.plan, billing.graceEndsAt);
    if (recipe.status !== "active" && recipe.status !== "deploying") {
      if (plan.tier === "free" && activeCount >= plan.maxActiveRecipes) {
        return NextResponse.json(
          {
            error:
              "Free plan limit reached (maximum 2 active recipes). Please deactivate an active recipe or upgrade to Pro to reactivate this website.",
            code: "PLAN_LIMIT_EXCEEDED",
          },
          { status: 403 }
        );
      }
    }

    // 3. Vault credential check
    const cfToken = await getCloudflareApiToken(user.id);
    if (!cfToken) {
      return NextResponse.json(
        {
          error: "Please connect your Cloudflare account before deploying.",
          code: "CLOUDFLARE_NOT_CONNECTED",
        },
        { status: 400 }
      );
    }

    // 4. Parse and validate file bundle
    const { files } = await parseUpdatePayload(req);
    const bundleValidation = validateFileBundle(files);
    if (!bundleValidation.valid) {
      return NextResponse.json(
        {
          error:
            bundleValidation.error ||
            "Website files must include an index.html at the root.",
        },
        { status: 400 }
      );
    }

    // 5. Trigger redeployment
    let deployResult;
    try {
      deployResult = await deployToCloudflarePages({
        apiToken: cfToken,
        projectName: recipe.subdomain,
        files,
        isUpdate: true,
      });
    } catch (deployError) {
      console.error("Redeployment failed:", deployError);
      return NextResponse.json(
        {
          error:
            deployError instanceof Error
              ? deployError.message
              : "Failed to redeploy website.",
        },
        { status: 500 }
      );
    }

    // 6. Update recipe record
    const updatedRecipe = await recipeStore.updateRecipe(
      user.id,
      recipeId,
      {
        status: deployResult.status,
        liveUrl: deployResult.url,
        metadata: {
          ...recipe.metadata,
          lastDeploymentId: deployResult.deploymentId,
          updatedFilesCount: files.length,
        },
      },
      plan.maxActiveRecipes
    );

    return NextResponse.json({ success: true, recipe: updatedRecipe }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error in POST /api/recipes/hosting/[id]/update:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
