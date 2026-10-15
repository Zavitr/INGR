import crypto from "node:crypto";
import { FilePayload, validateFileBundle, validateSubdomain } from "./types";

export interface DeployResult {
  deploymentId: string;
  projectName: string;
  url: string;
  aliases?: string[];
  status: "deploying" | "active" | "error";
  error?: string;
}

export interface CloudflareDeployOptions {
  apiToken: string;
  projectName: string; // Subdomain
  files: FilePayload[];
  isUpdate?: boolean;
}

export function isHermeticMode(token: string): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  if (process.env.TEST_MODE === "true" || process.env.CLOUDFLARE_MOCK === "true") {
    return true;
  }
  const lower = (token || "").toLowerCase();
  return (
    lower.startsWith("cf_test_") ||
    lower.startsWith("mock_") ||
    lower.startsWith("test_") ||
    lower === "mock"
  );
}

export function normalizeFiles(files: FilePayload[]): Array<{ path: string; buffer: Buffer; hash: string }> {
  return files.map((file) => {
    const cleanPath = file.path.replace(/^(\.|\/)+/, "");
    const normalizedPath = `/${cleanPath}`;
    const buf =
      file.encoding === "base64"
        ? Buffer.from(file.content, "base64")
        : Buffer.from(file.content, "utf8");
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    return {
      path: normalizedPath,
      buffer: buf,
      hash,
    };
  });
}

/**
 * Orchestrate deployment of static site assets to Cloudflare Pages.
 * Handles validation, project creation, direct upload deployment, and hermetic offline test mode.
 */
export async function deployToCloudflarePages(
  options: CloudflareDeployOptions
): Promise<DeployResult> {
  const { apiToken, projectName, files } = options;

  // 1. Validate subdomain
  const domainValidation = validateSubdomain(projectName);
  if (!domainValidation.valid) {
    throw new Error(domainValidation.error || "Invalid subdomain");
  }

  // 2. Validate file bundle (must contain root index.html)
  const bundleValidation = validateFileBundle(files);
  if (!bundleValidation.valid) {
    throw new Error(bundleValidation.error || "Missing index.html at root of website files.");
  }

  // 3. Hermetic test mode (offline, instant, deterministic)
  if (isHermeticMode(apiToken)) {
    const deploymentId = `dep_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const url = `https://${projectName}.pages.dev`;
    return {
      deploymentId,
      projectName,
      url,
      aliases: [url],
      status: "active",
    };
  }

  // 4. Live Cloudflare Pages API orchestration
  const normalized = normalizeFiles(files);
  const manifest: Record<string, string> = {};
  for (const f of normalized) {
    manifest[f.path] = f.hash;
  }

  // Resolve account ID
  const accountsRes = await fetch("https://api.cloudflare.com/client/v4/accounts", {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!accountsRes.ok) {
    const err = await accountsRes.text();
    throw new Error(`Failed to fetch Cloudflare accounts: ${accountsRes.statusText} (${err})`);
  }
  const accountsData = await accountsRes.json();
  const accountId = accountsData?.result?.[0]?.id;
  if (!accountId) {
    throw new Error("No Cloudflare account found for the provided API token.");
  }

  // Ensure project exists
  const projectRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`,
    { headers: { Authorization: `Bearer ${apiToken}` } }
  );

  if (projectRes.status === 404) {
    const createRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: projectName,
          production_branch: "main",
        }),
      }
    );
    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create Cloudflare Pages project: ${createRes.statusText} (${err})`);
    }
  }

  // Upload deployment manifest and files
  const formData = new FormData();
  formData.append("manifest", JSON.stringify(manifest));
  for (const f of normalized) {
    const blob = new Blob([new Uint8Array(f.buffer)]);
    formData.append(f.hash, blob, f.path);
  }

  const deployRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}` },
      body: formData,
    }
  );

  if (!deployRes.ok) {
    const err = await deployRes.text();
    throw new Error(`Failed to deploy to Cloudflare Pages: ${deployRes.statusText} (${err})`);
  }

  const deployData = await deployRes.json();
  const result = deployData.result;
  const liveUrl = `https://${projectName}.pages.dev`;

  return {
    deploymentId: result?.id || `dep_${Date.now()}`,
    projectName,
    url: liveUrl,
    aliases: result?.aliases || [liveUrl],
    status: "active",
  };
}
