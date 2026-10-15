import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import {
  listAppConnections,
  createSupabaseConnection,
  createCloudflareConnection,
  createOpenRouterConnection,
  createOracleConnection,
  deleteAppConnectionByExternalId,
} from "@/lib/activepieces/client";
import { getBillingAccount } from "@/lib/stripe/client";
import { getUserPlan } from "@/lib/recipes/types";

export async function GET(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connections = await listAppConnections(user.id);
    const serviceStatus: Record<string, boolean> = {
      supabase: false,
      cloudflare: false,
      openrouter: false,
      oracle: false,
    };

    for (const conn of connections) {
      if (conn.status !== "ACTIVE") continue;
      if (
        conn.externalId === `usr_${user.id}_supabase` ||
        conn.externalId === `user_${user.id}_supabase`
      ) {
        serviceStatus.supabase = true;
      }
      if (
        conn.externalId === `usr_${user.id}_cloudflare` ||
        conn.externalId === `user_${user.id}_cloudflare`
      ) {
        serviceStatus.cloudflare = true;
      }
      if (
        conn.externalId === `usr_${user.id}_openrouter` ||
        conn.externalId === `user_${user.id}_openrouter`
      ) {
        serviceStatus.openrouter = true;
      }
      if (
        conn.externalId === `usr_${user.id}_oracle` ||
        conn.externalId === `user_${user.id}_oracle`
      ) {
        serviceStatus.oracle = true;
      }
    }

    return NextResponse.json({ services: serviceStatus });
  } catch (error) {
    console.error("Failed to load connections:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load connections" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const service = typeof body?.service === "string" ? body.service : undefined;

    if (!service) {
      return NextResponse.json({ error: "Service is required" }, { status: 400 });
    }

    // Quota Enforcement: Check current connected services count
    const billing = await getBillingAccount(user.id);
    const plan = getUserPlan(user, 0, billing.plan, billing.graceEndsAt);

    if (plan.tier === "free") {
      const connections = await listAppConnections(user.id);
      const activeConnections = connections.filter(
        (c) => c.status === "ACTIVE" && c.externalId.includes(`_${user.id}_`)
      );

      // Check if this service is already connected (reconnect doesn't consume extra quota)
      const isAlreadyConnected = activeConnections.some((c) =>
        c.externalId.endsWith(`_${service}`)
      );

      if (!isAlreadyConnected && activeConnections.length >= plan.maxConnectedServices) {
        return NextResponse.json(
          {
            error:
              "Free plan limit reached (maximum 3 connected services). Upgrade to Pro for unlimited connected services, or disconnect an existing service.",
            code: "SERVICES_LIMIT_EXCEEDED",
          },
          { status: 403 }
        );
      }
    }

    if (service === "supabase") {
      const url = typeof body.url === "string" ? body.url : "";
      const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
      if (!url || !apiKey) {
        return NextResponse.json(
          { error: "Missing Supabase URL or API Key" },
          { status: 400 }
        );
      }
      const connection = await createSupabaseConnection(url, apiKey, user.id);
      return NextResponse.json({ success: true, service: "supabase", connection });
    }

    if (service === "cloudflare") {
      const token =
        (typeof body.apiToken === "string" ? body.apiToken : "") ||
        (typeof body.apiKey === "string" ? body.apiKey : "");
      if (!token) {
        return NextResponse.json(
          { error: "Missing Cloudflare API Token" },
          { status: 400 }
        );
      }
      const connection = await createCloudflareConnection(token, user.id);
      return NextResponse.json({ success: true, service: "cloudflare", connection });
    }

    if (service === "openrouter") {
      const key =
        (typeof body.apiKey === "string" ? body.apiKey : "") ||
        (typeof body.apiToken === "string" ? body.apiToken : "");
      if (!key) {
        return NextResponse.json(
          { error: "Missing OpenRouter API Key" },
          { status: 400 }
        );
      }
      const connection = await createOpenRouterConnection(key, user.id);
      return NextResponse.json({ success: true, service: "openrouter", connection });
    }

    if (service === "oracle") {
      const connection = await createOracleConnection(body.credentials || body, user.id);
      return NextResponse.json({ success: true, service: "oracle", connection });
    }

    return NextResponse.json({ error: "Unsupported service" }, { status: 400 });
  } catch (error) {
    console.error("Failed to connect service:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect service" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let service: string | null = null;
    try {
      const body = (await req.json()) as Record<string, unknown>;
      service = typeof body?.service === "string" ? body.service : null;
    } catch {
      // Body may not be JSON
    }

    if (!service) {
      const { searchParams } = new URL(req.url);
      service = searchParams.get("service");
    }

    if (!service || !["supabase", "cloudflare", "openrouter", "oracle"].includes(service)) {
      return NextResponse.json(
        { error: "Valid service name is required (supabase, cloudflare, openrouter, or oracle)" },
        { status: 400 }
      );
    }

    await deleteAppConnectionByExternalId(`usr_${user.id}_${service}`);
    await deleteAppConnectionByExternalId(`user_${user.id}_${service}`);

    return NextResponse.json({ success: true, service });
  } catch (error) {
    console.error("Failed to disconnect service:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to disconnect service" },
      { status: 500 }
    );
  }
}

