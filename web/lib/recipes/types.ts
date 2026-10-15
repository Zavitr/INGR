export type RecipeType = "hosting" | "uptime" | string;
export type RecipeStatus = "deploying" | "active" | "inactive" | "error";

export interface Recipe {
  id: string;
  userId: string;
  type: RecipeType;
  name: string;
  status: RecipeStatus;
  subdomain: string;
  liveUrl: string | null;
  services: string[];
  metadata: Record<string, unknown>;
  isPublic?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecipeInput {
  id?: string;
  userId: string;
  type?: RecipeType;
  name: string;
  status?: RecipeStatus;
  subdomain: string;
  liveUrl?: string | null;
  services?: string[];
  metadata?: Record<string, unknown>;
  isPublic?: boolean;
}

export interface UpdateRecipeInput {
  name?: string;
  status?: RecipeStatus;
  liveUrl?: string | null;
  metadata?: Record<string, unknown>;
  isPublic?: boolean;
}

export type PlanTier = "free" | "pro";

export interface PlanInfo {
  tier: PlanTier;
  maxActiveRecipes: number;
  maxConnectedServices: number;
  canActivateMore: boolean;
  isGracePeriod?: boolean;
  graceEndsAt?: string | null;
}

export interface FilePayload {
  path: string;
  content: string;
  encoding?: "utf-8" | "base64";
}

/**
 * Validates subdomain:
 * - Lowercase alphanumeric and hyphens
 * - 3 to 63 characters
 * - No leading or trailing hyphen
 */
export function isValidSubdomain(subdomain: string): boolean {
  if (!subdomain || typeof subdomain !== "string" || subdomain !== subdomain.trim()) return false;
  return /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(subdomain);
}

export function validateSubdomain(subdomain: string): { valid: boolean; error?: string } {
  if (!subdomain || typeof subdomain !== "string" || subdomain.trim().length === 0) {
    return { valid: false, error: "Web address (subdomain) is required." };
  }
  if (subdomain !== subdomain.trim()) {
    return { valid: false, error: "Web address cannot contain spaces." };
  }
  const trimmed = subdomain.trim();
  if (trimmed.length < 3) {
    return { valid: false, error: "Web address must be at least 3 characters long." };
  }
  if (trimmed.length > 63) {
    return { valid: false, error: "Web address must be at most 63 characters long." };
  }
  if (trimmed !== trimmed.toLowerCase()) {
    return { valid: false, error: "Web address must be lowercase." };
  }
  if (trimmed.startsWith("-") || trimmed.endsWith("-")) {
    return { valid: false, error: "Web address cannot start or end with a hyphen." };
  }
  if (!/^[a-z0-9-]+$/.test(trimmed)) {
    return { valid: false, error: "Web address can only contain letters, numbers, and hyphens." };
  }
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(trimmed)) {
    return { valid: false, error: "Invalid web address format." };
  }
  return { valid: true };
}

/**
 * Validates that uploaded file bundle contains root index.html
 */
export function validateFileBundle(files: FilePayload[]): { valid: boolean; error?: string } {
  if (!files || !Array.isArray(files) || files.length === 0) {
    return { valid: false, error: "At least one file is required." };
  }
  for (const f of files) {
    if (!f || typeof f !== "object" || typeof f.path !== "string" || !f.path.trim() || typeof f.content !== "string") {
      return { valid: false, error: "Invalid file bundle structure" };
    }
  }
  const hasRootIndex = files.some((f) => {
    const normalized = f.path.replace(/^(\.|\/)+/, "");
    return normalized === "index.html";
  });
  if (!hasRootIndex) {
    return { valid: false, error: "Website files must include an index.html at the root." };
  }
  return { valid: true };
}

/**
 * Determines plan tier and maximum allowed active recipes.
 * Free tier: max 2 active recipes, max 3 connected services.
 * Pro tier: unlimited active recipes, unlimited connected services.
 * Note: Never trust user_metadata for plan privileges. Only app_metadata or verified billing state.
 */
export function getUserPlan(
  user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null,
  activeCount = 0,
  overrideTier?: PlanTier,
  graceEndsAt?: string | null
): PlanInfo {
  // Strictly server-verified: app_metadata or overrideTier. Never trust user_metadata.
  const serverTier = overrideTier || (user?.app_metadata?.plan as string);
  const tier: PlanTier = serverTier === "pro" ? "pro" : "free";
  const maxActiveRecipes = tier === "pro" ? Infinity : 2;
  const maxConnectedServices = tier === "pro" ? Infinity : 3;
  const canActivateMore = activeCount < maxActiveRecipes;

  const isGracePeriod = Boolean(graceEndsAt && new Date(graceEndsAt).getTime() > Date.now());

  return {
    tier,
    maxActiveRecipes,
    maxConnectedServices,
    canActivateMore,
    isGracePeriod,
    graceEndsAt: graceEndsAt || null,
  };
}

/**
 * Uptime Monitor Target Specification
 */
export interface UptimeMonitorTarget {
  url: string;
  name: string;
  intervalSeconds?: number;
}

/**
 * Uptime Alert Notification Channel
 */
export interface UptimeNotificationChannel {
  type: "email" | "discord" | "slack" | "webhook";
  target: string;
}

/**
 * Uptime Monitor Specific Metadata
 */
export interface UptimeRecipeMetadata {
  targets: UptimeMonitorTarget[];
  notification: UptimeNotificationChannel;
  statusPageUrl: string | null;
  uptimePercent?: number;
  instanceId?: string;
  lastCheck?: string;
  monitorsCount?: number;
}

/**
 * Validates a website URL for uptime monitoring
 */
export function validateMonitorUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== "string" || !url.trim()) {
    return { valid: false, error: "Website address is required." };
  }
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, error: "Website address must start with http:// or https://" };
    }
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return { valid: false, error: "Please enter a complete website domain address." };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Please enter a valid website address (e.g. https://example.com)." };
  }
}

/**
 * Validates alert notification channel settings
 */
export function validateNotificationChannel(
  type: string,
  target: string
): { valid: boolean; error?: string } {
  if (!type || !["email", "discord", "slack", "webhook"].includes(type)) {
    return { valid: false, error: "Please select a valid notification method (email, Discord, Slack, or webhook)." };
  }
  if (!target || typeof target !== "string" || !target.trim()) {
    return { valid: false, error: "Notification destination is required." };
  }
  const trimmed = target.trim();
  if (type === "email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { valid: false, error: "Please enter a valid email address." };
    }
  } else if (type === "discord" || type === "slack" || type === "webhook") {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:") {
        return { valid: false, error: `${type} notification address must start with https://` };
      }
    } catch {
      return { valid: false, error: `Please enter a valid ${type} notification address.` };
    }
  }
  return { valid: true };
}

/**
 * Validates a collection of uptime monitor targets
 */
export function validateUptimeTargets(
  targets: UptimeMonitorTarget[]
): { valid: boolean; error?: string } {
  if (!targets || !Array.isArray(targets) || targets.length === 0) {
    return { valid: false, error: "At least one website must be specified for monitoring." };
  }
  if (targets.length > 25) {
    return { valid: false, error: "Maximum 25 websites can be monitored per instance." };
  }
  for (const t of targets) {
    if (!t || typeof t !== "object") {
      return { valid: false, error: "Invalid website monitoring specification." };
    }
    const urlValidation = validateMonitorUrl(t.url);
    if (!urlValidation.valid) {
      return urlValidation;
    }
  }
  return { valid: true };
}
