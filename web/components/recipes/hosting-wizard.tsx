"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  ExternalLink,
  FileCode,
  FolderUp,
  Globe,
  Loader2,
  Lock,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { FilePayload, validateSubdomain } from "@/lib/recipes/types";
import {
  processUploadedFiles,
  getStarterWebsiteFiles,
  hasRootIndexHtml,
} from "@/lib/recipes/file-reader";

type WizardStep = 1 | 2 | 3 | 4;

interface HostingWizardProps {
  initialConnected?: boolean;
}

export function HostingWizard({ initialConnected = false }: HostingWizardProps) {
  // Wizard Navigation
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Step 1: Account
  const [isCheckingAccount, setIsCheckingAccount] = useState(!initialConnected);
  const [isConnected, setIsConnected] = useState(initialConnected);
  const [apiToken, setApiToken] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Step 2: Upload Files
  const [files, setFiles] = useState<FilePayload[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Web Address & Sharing
  const [subdomain, setSubdomain] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [customDomainOpen, setCustomDomainOpen] = useState(false);

  // Step 4: Publish & Go Live
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishPhase, setPublishPhase] = useState<number>(0);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Check account connection on mount
  useEffect(() => {
    async function checkAccount() {
      try {
        const res = await fetch("/api/services");
        if (res.ok) {
          const data = await res.json();
          if (data.services?.cloudflare) {
            setIsConnected(true);
          }
        }
      } catch {
        // network or server error, keep state
      } finally {
        setIsCheckingAccount(false);
      }
    }
    checkAccount();
  }, []);

  // Step 1: Handle Connect Cloudflare
  const handleConnectService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiToken.trim()) {
      setAccountError("Please enter your secret token.");
      return;
    }

    setIsConnecting(true);
    setAccountError(null);

    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "cloudflare",
          apiToken: apiToken.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not connect account. Please check your token.");
      }

      setIsConnected(true);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Failed to connect.");
    } finally {
      setIsConnecting(false);
    }
  };

  // Step 2: File Handlers
  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsProcessingFiles(true);
      setFileError(null);
      try {
        const rawFiles = Array.from(e.dataTransfer.files);
        const processed = await processUploadedFiles(rawFiles);
        setFiles(processed);
      } catch {
        setFileError("Could not read website files. Please ensure the zip archive or files are valid.");
      } finally {
        setIsProcessingFiles(false);
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsProcessingFiles(true);
      setFileError(null);
      try {
        const rawFiles = Array.from(e.target.files);
        const processed = await processUploadedFiles(rawFiles);
        setFiles(processed);
      } catch {
        setFileError("Could not read website files. Please ensure the zip archive or files are valid.");
      } finally {
        setIsProcessingFiles(false);
      }
    }
  };

  const handleUseStarterTemplate = () => {
    setFileError(null);
    const starter = getStarterWebsiteFiles();
    setFiles(starter);
  };

  const handleRemoveFile = (pathToRemove: string) => {
    setFiles((prev) => prev.filter((f) => f.path !== pathToRemove));
  };

  const handleClearAllFiles = () => {
    setFiles([]);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  const isFilesValid = files.length > 0 && hasRootIndexHtml(files);

  // Step 3: Subdomain validation
  const subdomainCheck = validateSubdomain(subdomain);
  const isSubdomainValid = subdomainCheck.valid;

  // Step 4: Publish Website
  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishError(null);
    setPublishPhase(1);

    try {
      // Phase 1: Preparing files
      await new Promise((r) => setTimeout(r, 600));
      setPublishPhase(2);

      // Phase 2: Uploading to global network
      const res = await fetch("/api/recipes/hosting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subdomain: subdomain.trim().toLowerCase(),
          name: subdomain.trim().toLowerCase(),
          isPublic,
          files,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to publish website. Please try again.");
      }

      // Phase 3: Live
      setPublishPhase(3);
      await new Promise((r) => setTimeout(r, 400));

      const finalUrl = data.recipe?.liveUrl || `https://${subdomain.trim().toLowerCase()}.pages.dev`;
      setLiveUrl(finalUrl);
      setPublishSuccess(true);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Failed to publish website.");
      setPublishPhase(0);
    } finally {
      setIsPublishing(false);
    }
  };

  const copyLiveUrl = () => {
    if (liveUrl) {
      navigator.clipboard.writeText(liveUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setFiles([]);
    setSubdomain("");
    setPublishSuccess(false);
    setPublishError(null);
    setLiveUrl(null);
    setPublishPhase(0);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8 flex flex-col gap-8">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col gap-3">
        <Link
          href="/protected/recipes"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Recipes
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Free Website Hosting</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Publish your website to the global network with a free web address and automatic security.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs bg-muted px-3 py-1.5 rounded-full border border-border w-fit text-muted-foreground">
            <Lock size={13} className="text-green-500" />
            <span>Secure connection guaranteed</span>
          </div>
        </div>
      </div>

      {/* Stepper Navigation */}
      {!publishSuccess && (
        <div className="grid grid-cols-4 gap-2 border-b border-border/40 pb-6">
          {[
            { step: 1, label: "1. Account" },
            { step: 2, label: "2. Upload Files" },
            { step: 3, label: "3. Web Address" },
            { step: 4, label: "4. Publish" },
          ].map((item) => {
            const isCompleted = currentStep > item.step;
            const isCurrent = currentStep === item.step;
            return (
              <div
                key={item.step}
                className={`flex flex-col gap-1.5 pb-2 transition-colors ${
                  isCurrent
                    ? "border-b-2 border-primary text-primary font-semibold"
                    : isCompleted
                    ? "border-b-2 border-green-500 text-green-600 dark:text-green-400 font-medium"
                    : "text-muted-foreground/60 border-b-2 border-transparent"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs md:text-sm">
                  {isCompleted ? (
                    <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                  ) : (
                    <span
                      className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                        isCurrent
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.step}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Step Content */}
      <div className="flex flex-col gap-6">
        {/* STEP 1: Account Check */}
        {currentStep === 1 && !publishSuccess && (
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 flex flex-col gap-6 shadow-sm">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Step 1: Connect Your Cloudflare Account</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Cloudflare hosts your website on their global network completely free with zero renewal fees.
              </p>
            </div>

            {isCheckingAccount ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Checking your connected services...</span>
              </div>
            ) : isConnected ? (
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
                    <Check size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                      Cloudflare is connected
                      <span className="text-[11px] bg-green-500/20 text-green-700 dark:text-green-300 font-medium px-2 py-0.5 rounded-full">
                        Ready
                      </span>
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Your Cloudflare connection is active and ready to host websites.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Continue to Upload Files
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="rounded-xl border border-border bg-secondary/30 p-5 flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Cloud size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">Connect Cloudflare</h3>
                      <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                        To host your website, connect your free Cloudflare account using your secret token.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleConnectService} className="flex flex-col gap-4 mt-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Cloudflare Secret Token
                      </label>
                      <input
                        type="password"
                        value={apiToken}
                        onChange={(e) => setApiToken(e.target.value)}
                        placeholder="Paste your secret token here"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                        <span>Stored safely in your private vault</span>
                        <a
                          href="https://dash.cloudflare.com/profile/api-tokens"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Create token in Cloudflare
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>

                    {accountError && (
                      <div className="text-xs text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
                        {accountError}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={isConnecting}
                        className="w-full sm:w-auto inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {isConnecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          "Connect Account"
                        )}
                      </button>

                      <a
                        href="https://dash.cloudflare.com/sign-up"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        Get a free account
                        <ExternalLink className="ml-2 h-3.5 w-3.5" />
                      </a>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Upload Files */}
        {currentStep === 2 && !publishSuccess && (
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 flex flex-col gap-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Step 2: Upload Website Files</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Upload your website files or a zip file. Your website must have a main file named{" "}
                  <code className="text-primary font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                    index.html
                  </code>{" "}
                  at the root.
                </p>
              </div>

              <button
                type="button"
                onClick={handleUseStarterTemplate}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/10 px-3 py-2 rounded-lg transition-colors shrink-0"
              >
                <Sparkles size={14} />
                Try sample starter website
              </button>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-2xl p-8 md:p-12 text-center flex flex-col items-center justify-center transition-all ${
                isDragging
                  ? "border-primary bg-primary/5 scale-[0.99]"
                  : "border-border/80 hover:border-primary/50 bg-secondary/20"
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <UploadCloud size={28} />
              </div>
              <h3 className="text-base font-semibold mb-1">
                Drop your website files or zip folder here
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-5">
                Supports HTML, CSS, JavaScript files, images, or a .zip package.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="file-upload-input"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-4 text-xs font-medium hover:bg-accent transition-colors shadow-sm"
                >
                  <FileCode className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  Select Files
                </button>

                <input
                  ref={folderInputRef}
                  type="file"
                  // @ts-expect-error webkitdirectory is standard in browsers
                  webkitdirectory=""
                  directory=""
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="folder-upload-input"
                />
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-4 text-xs font-medium hover:bg-accent transition-colors shadow-sm"
                >
                  <FolderUp className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  Select Folder
                </button>
              </div>

              {isProcessingFiles && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4">
                  <Loader2 size={13} className="animate-spin text-primary" />
                  <span>Reading files...</span>
                </div>
              )}
            </div>

            {/* File Error */}
            {fileError && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2.5">
                <AlertCircle size={16} className="shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {/* Validation Banner */}
            {files.length > 0 && (
              <div>
                {hasRootIndexHtml(files) ? (
                  <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3.5 flex items-center gap-2.5 text-xs text-green-700 dark:text-green-300">
                    <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                    <span>
                      Main file detected: <strong className="font-semibold">index.html</strong> is present at the root.
                    </span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-300">
                    <span className="font-bold text-amber-500 text-sm">!</span>
                    <span>
                      Missing main file: Please ensure your website includes an{" "}
                      <strong className="font-semibold">index.html</strong> file at the root.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* File List Preview */}
            {files.length > 0 && (
              <div className="flex flex-col gap-3 border border-border rounded-xl p-4 bg-background">
                <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Files ready ({files.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleClearAllFiles}
                    className="text-xs text-destructive hover:underline"
                  >
                    Clear all
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 pr-1">
                  {files.map((file) => (
                    <div
                      key={file.path}
                      className="flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs bg-muted/40 hover:bg-muted/70 transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileCode size={13} className="text-primary shrink-0" />
                        <span className="truncate font-mono">{file.path}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-muted-foreground">
                          {Math.max(1, Math.round(file.content.length / 1024))} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(file.path)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove file"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium hover:bg-accent transition-colors"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </button>

              <button
                type="button"
                disabled={!isFilesValid}
                onClick={() => setCurrentStep(3)}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
              >
                Next: Choose Web Address
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Web Address */}
        {currentStep === 3 && !publishSuccess && (
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 flex flex-col gap-6 shadow-sm">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Step 3: Choose Your Web Address</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Pick a free web address for your website. You can also connect your own custom address anytime.
              </p>
            </div>

            {/* Subdomain Input */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-foreground">
                Free Web Address
              </label>
              <div className="flex items-center rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-primary overflow-hidden">
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase().trim())}
                  placeholder="my-awesome-site"
                  className="h-11 flex-1 bg-transparent px-3 text-sm focus:outline-none"
                />
                <span className="bg-muted px-3.5 py-2.5 text-xs text-muted-foreground font-medium border-l border-border">
                  .pages.dev
                </span>
              </div>

              {/* Validation helper */}
              {subdomain.length > 0 && (
                <div className="text-xs mt-1">
                  {isSubdomainValid ? (
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1 font-medium">
                      <Check size={13} />
                      Looks great! Your address will be https://{subdomain}.pages.dev
                    </span>
                  ) : (
                    <span className="text-destructive">
                      {subdomainCheck.error || "Web address must be 3-63 characters, lowercase letters, numbers, or hyphens."}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Live Address Preview Card */}
            <div className="rounded-xl border border-border bg-secondary/30 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Globe size={18} />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Live Web Address Preview</span>
                  <p className="text-sm font-mono font-medium text-foreground">
                    https://{subdomain || "your-site"}.pages.dev
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Domain Accordion */}
            <div className="rounded-xl border border-border/80 bg-background overflow-hidden">
              <button
                type="button"
                onClick={() => setCustomDomainOpen(!customDomainOpen)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">Bring your own web address (Optional)</span>
                  <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-medium">
                    Custom domain
                  </span>
                </div>
                {customDomainOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {customDomainOpen && (
                <div className="p-4 pt-1 border-t border-border/50 text-xs text-muted-foreground flex flex-col gap-2 leading-relaxed">
                  <p>
                    Want to use your own web address like <strong className="text-foreground">mybusiness.com</strong>?
                  </p>
                  <p>
                    After your website is published, you can link any web address you own directly in your Cloudflare dashboard with zero fees. INGR sets up the hosting, and Cloudflare provides the free secure connection.
                  </p>
                </div>
              )}
            </div>

            {/* Community Template Sharing Toggle */}
            <div className="rounded-xl border border-border/80 bg-background p-4 flex items-center justify-between">
              <div className="space-y-0.5 pr-4">
                <span className="text-xs font-semibold text-foreground">Make this recipe a public template?</span>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  If enabled, others in the community can discover and use your recipe as a starter template. If kept private, it remains visible only to you.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium hover:bg-accent transition-colors"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </button>

              <button
                type="button"
                disabled={!isSubdomainValid}
                onClick={() => setCurrentStep(4)}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
              >
                Next: Review & Publish
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Publish & Go Live */}
        {currentStep === 4 && !publishSuccess && (
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 flex flex-col gap-6 shadow-sm">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Step 4: Publish Your Website</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Review your website details and publish to Cloudflare&apos;s worldwide network.
              </p>
            </div>

            {/* Summary Details */}
            <div className="rounded-xl border border-border bg-secondary/30 p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3 text-sm">
                <span className="text-muted-foreground">Web Address:</span>
                <span className="font-mono font-semibold text-primary">
                  https://{subdomain}.pages.dev
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 pb-3 text-sm">
                <span className="text-muted-foreground">Total Files:</span>
                <span className="font-medium text-foreground">{files.length} files</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Hosting Provider:</span>
                <span className="font-medium text-foreground">Cloudflare (Free)</span>
              </div>
            </div>

            {/* Publishing Progress State */}
            {isPublishing && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 flex flex-col gap-4">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-primary" />
                  Publishing your website...
                </h3>

                <div className="flex flex-col gap-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    {publishPhase > 1 ? (
                      <CheckCircle2 size={14} className="text-green-500" />
                    ) : (
                      <Loader2 size={14} className="animate-spin text-primary" />
                    )}
                    <span className={publishPhase >= 1 ? "font-medium text-foreground" : "text-muted-foreground"}>
                      Preparing files...
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {publishPhase > 2 ? (
                      <CheckCircle2 size={14} className="text-green-500" />
                    ) : publishPhase === 2 ? (
                      <Loader2 size={14} className="animate-spin text-primary" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 inline-block" />
                    )}
                    <span className={publishPhase >= 2 ? "font-medium text-foreground" : "text-muted-foreground"}>
                      Uploading to global network...
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {publishPhase >= 3 ? (
                      <CheckCircle2 size={14} className="text-green-500" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 inline-block" />
                    )}
                    <span className={publishPhase >= 3 ? "font-medium text-foreground" : "text-muted-foreground"}>
                      Your site is live!
                    </span>
                  </div>
                </div>
              </div>
            )}

            {publishError && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive flex flex-col gap-2">
                <span className="font-semibold">Unable to publish website:</span>
                <span>{publishError}</span>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <button
                type="button"
                disabled={isPublishing}
                onClick={() => setCurrentStep(3)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </button>

              <button
                type="button"
                disabled={isPublishing}
                onClick={handlePublish}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Publish Website
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Celebratory Completion Card */}
        {publishSuccess && liveUrl && (
          <div className="rounded-2xl border border-green-500/30 bg-card p-8 md:p-12 text-center flex flex-col items-center gap-6 shadow-md relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 inset-x-0 h-32 bg-green-500/10 rounded-b-full pointer-events-none" />

            <div className="w-16 h-16 rounded-2xl bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center shadow-inner">
              <Sparkles size={32} />
            </div>

            <div className="max-w-md">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Your website is live!</h2>
              <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                Your website has been published to Cloudflare&apos;s global network and is accessible worldwide.
              </p>
            </div>

            {/* Live URL Pill / Card */}
            <div className="w-full max-w-lg rounded-xl border border-border bg-secondary/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 truncate">
                <Globe size={18} className="text-green-500 shrink-0" />
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm font-semibold text-primary hover:underline truncate"
                >
                  {liveUrl}
                </a>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={copyLiveUrl}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-3 text-xs font-medium hover:bg-accent transition-colors shadow-sm"
                >
                  {copiedUrl ? (
                    <>
                      <Check size={13} className="mr-1.5 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={13} className="mr-1.5" />
                      Copy Link
                    </>
                  )}
                </button>

                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Visit Website
                  <ExternalLink size={13} className="ml-1.5" />
                </a>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-border/50 w-full justify-center">
              <Link
                href="/protected/recipes"
                className="w-full sm:w-auto inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                View in Dashboard
              </Link>

              <button
                type="button"
                onClick={resetWizard}
                className="w-full sm:w-auto inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-6 text-sm font-medium hover:bg-accent transition-colors"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Publish Another Website
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
