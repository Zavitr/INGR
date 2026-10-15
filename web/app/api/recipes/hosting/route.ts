import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { getCloudflareApiToken } from "@/lib/activepieces/client";
import { recipeStore } from "@/lib/recipes/store";
import {
  FilePayload,
  getUserPlan,
  validateFileBundle,
  validateSubdomain,
} from "@/lib/recipes/types";
import { deployToCloudflarePages } from "@/lib/recipes/cloudflare-pages";
import { getBillingAccount } from "@/lib/stripe/client";

async function parseHostingPayload(req: Request): Promise<{
  subdomain?: string;
  name?: string;
  isPublic?: boolean;
  files: FilePayload[];
}> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const json = await req.json();
      return {
        subdomain: json.subdomain,
        name: json.name,
        isPublic: Boolean(json.isPublic),
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
      const subdomain = formData.get("subdomain") as string | undefined;
      const name = formData.get("name") as string | undefined;
      const isPublicField = formData.get("isPublic");
      const isPublic = isPublicField === "true" || isPublicField === "1";
      const files: FilePayload[] = [];

      const filesField = formData.get("files");
      if (typeof filesField === "string") {
        try {
          const parsed = JSON.parse(filesField);
          if (Array.isArray(parsed)) {
            files.push(...parsed);
          }
        } catch {
          // not JSON string
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

      return {
        subdomain: subdomain || undefined,
        name: name || undefined,
        isPublic,
        files,
      };
    } catch {
      return { files: [] };
    }
  }

  // Fallback try json
  try {
    const json = await req.json();
    return {
      subdomain: json.subdomain,
      name: json.name,
      isPublic: Boolean(json.isPublic),
      files: Array.isArray(json.files) ? json.files : [],
    };
  } catch {
    return { files: [] };
  }
}

export async function POST(req: Request) {
  try {
    // 1. Authentication check
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Vault credential check (Cloudflare connection required)
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

    // 4. Payload extraction and validation
    const parsed = await parseHostingPayload(req);
    const files = parsed.files;
    const name = typeof parsed.name === "string" ? parsed.name.trim() : parsed.name;
    const subdomain = typeof parsed.subdomain === "string" ? parsed.subdomain.trim() : "";

    if (!subdomain) {
      return NextResponse.json(
        { error: "Web address (subdomain) is required." },
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

    // 5. Reserve recipe slot synchronously to prevent TOCTOU race conditions
    let recipe = await recipeStore.createRecipe({
      userId: user.id,
      type: "hosting",
      name: name || subdomain,
      status: "deploying",
      subdomain,
      liveUrl: `https://${subdomain}.pages.dev`,
      services: ["cloudflare"],
      isPublic: Boolean(parsed.isPublic),
      metadata: {
        fileCount: files.length,
      },
    });

    // 6. Trigger deployment
    try {
      const deployResult = await deployToCloudflarePages({
        apiToken: cfToken,
        projectName: subdomain,
        files,
      });

      const updated = await recipeStore.updateRecipe(user.id, recipe.id, {
        status: deployResult.status,
        liveUrl: deployResult.url,
        metadata: {
          deploymentId: deployResult.deploymentId,
          fileCount: files.length,
        },
      });
      if (updated) {
        recipe = updated;
      }
    } catch (deployError) {
      console.error("Cloudflare deployment failed:", deployError);
      // Mark as error so it doesn't consume an active quota slot
      await recipeStore.updateRecipe(user.id, recipe.id, {
        status: "error",
        metadata: {
          error: deployError instanceof Error ? deployError.message : "Deployment failed",
        },
      });

      return NextResponse.json(
        {
          error:
            deployError instanceof Error
              ? deployError.message
              : "Failed to deploy website to Cloudflare Pages.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, recipe }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/recipes/hosting:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
