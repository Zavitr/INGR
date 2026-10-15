"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Globe,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  UploadCloud,
  FileCode,
  AlertTriangle,
  X,
  CheckCircle2,
  Calendar,
  MonitorPlay,
} from "lucide-react";
import { Recipe, PlanInfo, FilePayload } from "@/lib/recipes/types";
import {
  processUploadedFiles,
  hasRootIndexHtml,
  getStarterWebsiteFiles,
} from "@/lib/recipes/file-reader";

interface RecipeListProps {
  initialRecipes: Recipe[];
  initialActiveCount: number;
  initialPlan: PlanInfo;
}

export function RecipeList({
  initialRecipes,
  initialActiveCount,
  initialPlan,
}: RecipeListProps) {
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [activeCount, setActiveCount] = useState<number>(initialActiveCount);
  const [plan] = useState<PlanInfo>(initialPlan);

  // Deactivate dialog state
  const [deactivatingRecipe, setDeactivatingRecipe] = useState<Recipe | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Update modal state
  const [updatingRecipe, setUpdatingRecipe] = useState<Recipe | null>(null);
  const [updateFiles, setUpdateFiles] = useState<FilePayload[]>([]);
  const [isProcessingUpdateFiles, setIsProcessingUpdateFiles] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const isFreeAtLimit =
    plan.tier === "free" && activeCount >= plan.maxActiveRecipes;

  // Handle deactivating / turning off a website
  const confirmDeactivate = async () => {
    if (!deactivatingRecipe) return;
    setIsDeactivating(true);
    setActionError(null);

    try {
      const deactUrl =
        deactivatingRecipe.type === "uptime"
          ? `/api/recipes/uptime/${deactivatingRecipe.id}/deactivate`
          : `/api/recipes/hosting/${deactivatingRecipe.id}/deactivate`;

      const res = await fetch(deactUrl, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not turn off website. Please try again.");
      }

      // Update local state
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === deactivatingRecipe.id ? { ...r, status: "inactive" } : r
        )
      );
      setActiveCount((prev) => Math.max(0, prev - 1));
      setDeactivatingRecipe(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to turn off website.");
    } finally {
      setIsDeactivating(false);
    }
  };

  // Handle update website
  const handleUpdateWebsite = async () => {
    if (!updatingRecipe) return;
    if (updateFiles.length === 0 || !hasRootIndexHtml(updateFiles)) {
      setUpdateError("Please include an index.html file at the root of your website.");
      return;
    }

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const res = await fetch(`/api/recipes/hosting/${updatingRecipe.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: updateFiles,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not update website. Please try again.");
      }

      const updated = data.recipe as Recipe;
      setRecipes((prev) =>
        prev.map((r) => (r.id === updatingRecipe.id ? updated : r))
      );

      if (updatingRecipe.status !== "active" && updated.status === "active") {
        setActiveCount((prev) => prev + 1);
      }

      setUpdateSuccess(true);
      setTimeout(() => {
        setUpdatingRecipe(null);
        setUpdateFiles([]);
        setUpdateSuccess(false);
      }, 1500);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Failed to update website.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsProcessingUpdateFiles(true);
      try {
        const raw = Array.from(e.target.files);
        const processed = await processUploadedFiles(raw);
        setUpdateFiles(processed);
      } catch {
        // error handling
      } finally {
        setIsProcessingUpdateFiles(false);
      }
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Recently";
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top Banner: Plan Usage */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border rounded-xl p-4 md:p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Globe size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-base">Website Hosting</h2>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-medium text-muted-foreground">
                {plan.tier === "pro"
                  ? `${activeCount} active websites (Pro)`
                  : `${activeCount} of ${plan.maxActiveRecipes} free websites active`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live static websites hosted for free on Cloudflare&apos;s global network.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isFreeAtLimit ? (
            <Link
              href="/protected/settings"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Upgrade to Pro for Unlimited
            </Link>
          ) : (
            <Link
              href="/protected/recipes/new?type=hosting"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Website
            </Link>
          )}
        </div>
      </div>

      {/* Free tier at limit warning banner */}
      {isFreeAtLimit && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              You have reached your limit of <strong>2 active websites</strong> on the free tier. Turn off an existing website or upgrade to Pro to add more.
            </span>
          </div>
          <Link
            href="/protected/settings"
            className="shrink-0 font-semibold underline hover:no-underline"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive">
          {actionError}
        </div>
      )}

      {/* Recipe Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {recipes.map((recipe) => {
          const isActive = recipe.status === "active";
          const isDeploying = recipe.status === "deploying";
          const isError = recipe.status === "error";
          const isInactive = recipe.status === "inactive";
          const displayUrl =
            recipe.liveUrl || `https://${recipe.subdomain}.pages.dev`;

          return (
            <div
              key={recipe.id}
              className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between gap-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col gap-3">
                {/* Header: Title and Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      {recipe.type === "uptime" ? <MonitorPlay size={20} /> : <Globe size={20} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-base leading-tight truncate">
                        {recipe.name || recipe.subdomain}
                      </h3>
                      <span className="text-xs text-muted-foreground font-mono">
                        {recipe.subdomain}.{recipe.type === "uptime" ? "status.ingr.app" : "pages.dev"}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isActive && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-semibold border border-green-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                        Active
                      </span>
                    )}
                    {isDeploying && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20">
                        <Loader2 size={12} className="animate-spin" />
                        Publishing
                      </span>
                    )}
                    {isInactive && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium border border-border">
                        <Pause size={10} />
                        Paused
                      </span>
                    )}
                    {isError && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20">
                        Error
                      </span>
                    )}
                  </div>
                </div>

                {/* Live URL Link */}
                <div className="rounded-xl border border-border/70 bg-secondary/30 p-3 flex items-center justify-between gap-2 mt-1">
                  <div className="flex items-center gap-2 truncate">
                    <Globe size={14} className="text-muted-foreground shrink-0" />
                    <a
                      href={displayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono font-medium text-primary hover:underline truncate"
                    >
                      {displayUrl}
                    </a>
                  </div>
                  <a
                    href={displayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground shrink-0 p-1 rounded hover:bg-muted"
                    title="Open live website"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>

                {/* Metadata / Deployed Date */}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                  <Calendar size={12} />
                  <span>Updated {formatDate(recipe.updatedAt || recipe.createdAt)}</span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => {
                    setUpdatingRecipe(recipe);
                    setUpdateFiles([]);
                    setUpdateError(null);
                    setUpdateSuccess(false);
                  }}
                  className="flex-1 inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-3 text-xs font-medium hover:bg-accent transition-colors shadow-sm"
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  Update Website
                </button>

                {isActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeactivatingRecipe(recipe);
                      setActionError(null);
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 text-destructive px-3 text-xs font-medium hover:bg-destructive/15 transition-colors"
                  >
                    <Pause className="mr-1.5 h-3.5 w-3.5" />
                    Turn Off
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setUpdatingRecipe(recipe);
                      setUpdateFiles([]);
                      setUpdateError(null);
                      setUpdateSuccess(false);
                    }}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300 px-3 text-xs font-medium hover:bg-green-500/20 transition-colors"
                  >
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Turn On
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Turn Off Confirmation Modal */}
      {deactivatingRecipe && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Turn off website?</h3>
              <button
                type="button"
                onClick={() => setDeactivatingRecipe(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Turning off <strong className="text-foreground">{deactivatingRecipe.name}</strong> will pause its live web address. You can update and turn it back on anytime.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
              <button
                type="button"
                onClick={() => setDeactivatingRecipe(null)}
                disabled={isDeactivating}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-4 text-xs font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeactivate}
                disabled={isDeactivating}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-destructive text-destructive-foreground px-4 text-xs font-medium hover:bg-destructive/90 transition-colors shadow-sm disabled:opacity-50"
              >
                {isDeactivating ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Turning off...
                  </>
                ) : (
                  "Turn Off Website"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Website Modal */}
      {updatingRecipe && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div>
                <h3 className="text-lg font-bold">Update Website</h3>
                <p className="text-xs text-muted-foreground">
                  Upload new website files for {updatingRecipe.subdomain}.pages.dev
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUpdatingRecipe(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {updateSuccess ? (
              <div className="p-8 text-center flex flex-col items-center gap-3">
                <CheckCircle2 size={40} className="text-green-500" />
                <h4 className="text-lg font-bold">Website Updated!</h4>
                <p className="text-xs text-muted-foreground">
                  Your updated files have been published to the global network.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Drag and Drop / Select Files */}
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center flex flex-col items-center justify-center bg-secondary/20">
                  <UploadCloud size={28} className="text-primary mb-2" />
                  <p className="text-xs font-medium mb-1">Upload new HTML, CSS, JS or .zip file</p>
                  <p className="text-[11px] text-muted-foreground mb-4">
                    Must include a main <code className="text-primary">index.html</code> at root.
                  </p>

                  <div className="flex items-center gap-2">
                    <label className="inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-3 text-xs font-medium hover:bg-accent cursor-pointer shadow-sm">
                      <FileCode className="mr-1.5 h-3 w-3 text-muted-foreground" />
                      Select Files
                      <input
                        type="file"
                        multiple
                        onChange={handleUpdateFileInput}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setUpdateFiles(getStarterWebsiteFiles())}
                      className="inline-flex h-8 items-center justify-center rounded-lg bg-primary/10 text-primary px-3 text-xs font-medium hover:bg-primary/20 transition-colors"
                    >
                      <Sparkles className="mr-1.5 h-3 w-3" />
                      Sample Template
                    </button>
                  </div>

                  {isProcessingUpdateFiles && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
                      <Loader2 size={12} className="animate-spin text-primary" />
                      <span>Reading files...</span>
                    </div>
                  )}
                </div>

                {/* Validation Banner */}
                {updateFiles.length > 0 && (
                  <div>
                    {hasRootIndexHtml(updateFiles) ? (
                      <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
                        <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                        <span>Ready: {updateFiles.length} files with root index.html</span>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                        <span className="font-bold text-amber-500">!</span>
                        <span>Please ensure your files contain an index.html file at the root.</span>
                      </div>
                    )}
                  </div>
                )}

                {updateError && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                    {updateError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => setUpdatingRecipe(null)}
                    disabled={isUpdating}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-4 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={isUpdating || updateFiles.length === 0 || !hasRootIndexHtml(updateFiles)}
                    onClick={handleUpdateWebsite}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Updating Website...
                      </>
                    ) : (
                      "Publish Updates"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
