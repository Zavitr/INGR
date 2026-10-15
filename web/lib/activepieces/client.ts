import crypto from "node:crypto";

const AP_BASE_URL = process.env.ACTIVEPIECES_API_URL || "http://localhost:8080";
const AP_ADMIN_EMAIL = process.env.ACTIVEPIECES_ADMIN_EMAIL || (process.env.NODE_ENV === "production" ? "" : "admin@ingr.local");
const AP_ADMIN_PASSWORD = process.env.ACTIVEPIECES_ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "IngrAdminPassword2026!");
const AP_JWT_SECRET = process.env.AP_JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : "1674d0902e1aff15e45f19bf3c777581");

function ensureProductionSecrets(): void {
  if (process.env.NODE_ENV === "production" && (!AP_ADMIN_PASSWORD || !AP_JWT_SECRET)) {
    throw new Error("FATAL: ACTIVEPIECES_ADMIN_PASSWORD and AP_JWT_SECRET must be explicitly configured in production.");
  }
}

interface ApAuthResponse {
  token: string;
  projectId: string;
}

let cachedToken: string | null = null;
let cachedProjectId: string | null = null;
let cachedPlatformId: string | null = null;
let tokenExpiresAt = 0;

export async function getActivepiecesAuth(): Promise<ApAuthResponse> {
  ensureProductionSecrets();
  const now = Date.now();
  if (cachedToken && cachedProjectId && now < tokenExpiresAt) {
    return { token: cachedToken, projectId: cachedProjectId };
  }

  const res = await fetch(`${AP_BASE_URL}/api/v1/authentication/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: AP_ADMIN_EMAIL,
      password: AP_ADMIN_PASSWORD,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to authenticate with Activepieces engine: ${res.statusText}`);
  }

  const data = await res.json();
  cachedToken = data.token;
  cachedProjectId = data.projectId;
  // Expire cache in 23 hours
  tokenExpiresAt = now + 23 * 60 * 60 * 1000;

  return { token: cachedToken!, projectId: cachedProjectId! };
}

export interface AppConnection {
  id: string;
  externalId: string;
  displayName: string;
  pieceName: string;
  status: "ACTIVE" | "ERROR";
}

export async function listAppConnections(userId?: string): Promise<AppConnection[]> {
  const { token, projectId } = await getActivepiecesAuth();
  const res = await fetch(`${AP_BASE_URL}/api/v1/app-connections?projectId=${projectId}&limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to list app connections: ${res.statusText}`);
  }

  const result = await res.json();
  const connections: AppConnection[] = result.data || [];

  if (userId) {
    const usrPrefix = `usr_${userId}_`;
    const userPrefix = `user_${userId}_`;
    return connections.filter(
      (conn) =>
        conn.externalId?.startsWith(usrPrefix) ||
        conn.externalId?.startsWith(userPrefix)
    );
  }

  return connections;
}

export async function createSupabaseConnection(url: string, apiKey: string, userId?: string) {
  const { token, projectId } = await getActivepiecesAuth();
  const externalId = userId ? `usr_${userId}_supabase` : "supabase_connection";
  const displayName = userId ? `Supabase (${userId})` : "Supabase Connection";

  const res = await fetch(`${AP_BASE_URL}/api/v1/app-connections`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      externalId,
      displayName,
      pieceName: "@activepieces/piece-supabase",
      type: "CUSTOM_AUTH",
      value: {
        type: "CUSTOM_AUTH",
        props: {
          url,
          apiKey,
        },
      },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.params?.error || errorBody?.message || "Failed to create Supabase connection");
  }

  return await res.json();
}

export async function createCloudflareConnection(apiToken: string, userId?: string) {
  const { token, projectId } = await getActivepiecesAuth();
  const externalId = userId ? `usr_${userId}_cloudflare` : "cloudflare_connection";
  const displayName = userId ? `Cloudflare (${userId})` : "Cloudflare Connection";

  const res = await fetch(`${AP_BASE_URL}/api/v1/app-connections`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      externalId,
      displayName,
      pieceName: "@activepieces/piece-http",
      type: "SECRET_TEXT",
      value: {
        type: "SECRET_TEXT",
        secret_text: apiToken,
      },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.params?.error || errorBody?.message || "Failed to create Cloudflare connection");
  }

  return await res.json();
}

export async function createOpenRouterConnection(apiKey: string, userId?: string) {
  const { token, projectId } = await getActivepiecesAuth();
  const externalId = userId ? `usr_${userId}_openrouter` : "openrouter_connection";
  const displayName = userId ? `OpenRouter (${userId})` : "OpenRouter Connection";

  const res = await fetch(`${AP_BASE_URL}/api/v1/app-connections`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      externalId,
      displayName,
      pieceName: "@activepieces/piece-http",
      type: "SECRET_TEXT",
      value: {
        type: "SECRET_TEXT",
        secret_text: apiKey,
      },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.params?.error || errorBody?.message || "Failed to create OpenRouter connection");
  }

  return await res.json();
}

export async function createOracleConnection(credentials: unknown, userId?: string) {
  const { token, projectId } = await getActivepiecesAuth();
  const externalId = userId ? `usr_${userId}_oracle` : "oracle_connection";
  const displayName = userId ? `Oracle Cloud (${userId})` : "Oracle Cloud Connection";

  let value: { type: string; secret_text?: string; props?: Record<string, unknown> };
  let type: string;

  if (typeof credentials === "string") {
    type = "SECRET_TEXT";
    value = {
      type: "SECRET_TEXT",
      secret_text: credentials,
    };
  } else if (credentials && typeof credentials === "object") {
    const credObj = credentials as Record<string, unknown>;
    if (typeof credObj.apiToken === "string" && !credObj.credentials && !credObj.tenancyOcid) {
      type = "SECRET_TEXT";
      value = {
        type: "SECRET_TEXT",
        secret_text: credObj.apiToken,
      };
    } else if (typeof credObj.apiKey === "string" && !credObj.credentials && !credObj.tenancyOcid) {
      type = "SECRET_TEXT";
      value = {
        type: "SECRET_TEXT",
        secret_text: credObj.apiKey,
      };
    } else {
      type = "CUSTOM_AUTH";
      const props = (credObj.credentials || credObj.props || credObj) as Record<string, unknown>;
      value = {
        type: "CUSTOM_AUTH",
        props: typeof props === "object" ? props : { config: props },
      };
    }
  } else {
    type = "SECRET_TEXT";
    value = {
      type: "SECRET_TEXT",
      secret_text: String(credentials || ""),
    };
  }

  const res = await fetch(`${AP_BASE_URL}/api/v1/app-connections`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      externalId,
      displayName,
      pieceName: "@activepieces/piece-http",
      type,
      value,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.params?.error || errorBody?.message || "Failed to create Oracle connection");
  }

  return await res.json();
}

export async function deleteAppConnectionByExternalId(externalId: string): Promise<boolean> {
  const { token, projectId } = await getActivepiecesAuth();
  const res = await fetch(`${AP_BASE_URL}/api/v1/app-connections?projectId=${projectId}&limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to list app connections: ${res.statusText}`);
  }

  const result = await res.json();
  const connections: AppConnection[] = result.data || [];
  const matches = connections.filter((c) => c.externalId === externalId);

  if (matches.length === 0) {
    return false;
  }

  for (const match of matches) {
    const delRes = await fetch(`${AP_BASE_URL}/api/v1/app-connections/${match.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!delRes.ok && delRes.status !== 404) {
      throw new Error(`Failed to delete app connection ${match.id}: ${delRes.statusText}`);
    }
  }

  return true;
}

function base64Url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function createEngineJwt(projectId: string, platformId: string, secret: string): string {
  const header = { alg: "HS256", typ: "JWT", kid: "1" };
  const payload = {
    id: "ingr-orchestrator",
    type: "ENGINE",
    projectId,
    platform: { id: platformId },
    iss: "activepieces",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const encH = base64Url(JSON.stringify(header));
  const encP = base64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encH}.${encP}`)
    .digest();
  return `${encH}.${encP}.${base64Url(signature)}`;
}

/**
 * Retrieve decrypted Cloudflare API Token for a specific user from Activepieces Vault.
 * In live mode, requests GET /api/v1/worker/app-connections/:externalId with ENGINE JWT.
 * In test/mock mode, returns the token (or mock token) cleanly.
 */
export async function getCloudflareApiToken(userId: string): Promise<string | null> {
  // Check if test environment has an explicit mock override
  if (process.env.MOCK_CLOUDFLARE_TOKEN && (process.env.TEST_MODE === "true" || process.env.NODE_ENV === "test")) {
    return process.env.MOCK_CLOUDFLARE_TOKEN;
  }

  try {
    const { token, projectId } = await getActivepiecesAuth();

    // Cache platformId if not already fetched
    if (!cachedPlatformId) {
      try {
        const projRes = await fetch(`${AP_BASE_URL}/api/v1/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (projRes.ok) {
          const projData = await projRes.json();
          cachedPlatformId = projData.platformId;
        }
      } catch (err) {
        console.warn("Could not retrieve platformId from project:", err);
      }
    }

    const platformId = cachedPlatformId || "XcG8yyL1IzhnBYFcMHBUt";
    const jwt = createEngineJwt(projectId, platformId, AP_JWT_SECRET);

    // Try both usr_${userId}_cloudflare and user_${userId}_cloudflare
    const candidateExternalIds = [
      `usr_${userId}_cloudflare`,
      `user_${userId}_cloudflare`,
    ];

    for (const extId of candidateExternalIds) {
      const res = await fetch(`${AP_BASE_URL}/api/v1/worker/app-connections/${extId}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      if (res.ok) {
        const data = await res.json();
        const secret = data?.value?.secret_text;
        if (typeof secret === "string" && secret.trim().length > 0) {
          return secret;
        }
      }
    }

    return null;
  } catch (err) {
    console.warn("Error retrieving Cloudflare API token from Activepieces vault:", err);
    return null;
  }
}
