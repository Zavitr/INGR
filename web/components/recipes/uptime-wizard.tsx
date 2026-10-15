"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  MonitorPlay,
  Plus,
  Server,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import {
  UptimeMonitorTarget,
  validateMonitorUrl,
  validateSubdomain,
} from "@/lib/recipes/types";

type WizardStep = 1 | 2 | 3 | 4;

interface UptimeWizardProps {
  initialConnected?: boolean;
}

export function UptimeWizard({ initialConnected = false }: UptimeWizardProps) {
  // Wizard Navigation
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Step 1: Account (Oracle Cloud)
  const [isCheckingAccount, setIsCheckingAccount] = useState(!initialConnected);
  const [isConnected, setIsConnected] = useState(initialConnected);
  const [oracleUserOcid, setOracleUserOcid] = useState("");
  const [oracleTenancyOcid, setOracleTenancyOcid] = useState("");
  const [oracleFingerprint, setOracleFingerprint] = useState("");
  const [oraclePrivateKey, setOraclePrivateKey] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Step 2: Websites to Monitor
  const [targets, setTargets] = useState<UptimeMonitorTarget[]>([
    { url: "https://", name: "My Main Website", intervalSeconds: 60 },
  ]);
  const [targetError, setTargetError] = useState<string | null>(null);

  // Step 3: Alerts & Notification Channel
  const [notifType, setNotifType] = useState<"email" | "webhook" | "discord">("email");
  const [notifTarget, setNotifTarget] = useState("");
  const [notifError, setNotifError] = useState<string | null>(null);

  // Step 4: Web Address & 1-Click Launch
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchPhase, setLaunchPhase] = useState<number>(0);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchSuccess, setLaunchSuccess] = useState(false);
  const [statusPageUrl, setStatusPageUrl] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Check account connection on mount
  useEffect(() => {
    async function checkAccount() {
      try {
        const res = await fetch("/api/services");
        if (res.ok) {
          const data = await res.json();
          if (data.services?.oracle) {
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

  // Step 1: Handle Connect Oracle Cloud
  const handleConnectService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oracleUserOcid.trim() || !oracleTenancyOcid.trim()) {
      setAccountError("Please provide your Oracle user and tenancy identifiers.");
      return;
    }

    setIsConnecting(true);
    setAccountError(null);

    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "oracle",
          credentials: {
            userOcid: oracleUserOcid.trim(),
            tenancyOcid: oracleTenancyOcid.trim(),
            fingerprint: oracleFingerprint.trim(),
            privateKey: oraclePrivateKey.trim(),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not connect Oracle Cloud. Please double-check your credentials.");
      }

      setIsConnected(true);
      setCurrentStep(2);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Failed to connect Oracle Cloud.");
    } finally {
      setIsConnecting(false);
    }
  };

  // Step 2: Target Website handlers
  const handleAddTarget = () => {
    if (targets.length >= 10) {
      setTargetError("You can monitor up to 10 websites on this monitor instance.");
      return;
    }
    setTargets([...targets, { url: "https://", name: `Website ${targets.length + 1}`, intervalSeconds: 60 }]);
    setTargetError(null);
  };

  const handleRemoveTarget = (index: number) => {
    if (targets.length <= 1) {
      setTargetError("You must monitor at least one website.");
      return;
    }
    setTargets(targets.filter((_, i) => i !== index));
    setTargetError(null);
  };

  const handleUpdateTarget = (index: number, field: keyof UptimeMonitorTarget, value: string | number) => {
    const updated = [...targets];
    updated[index] = { ...updated[index], [field]: value };
    setTargets(updated);
    setTargetError(null);
  };

  const handleValidateStep2 = () => {
    if (targets.length === 0) {
      setTargetError("Please add at least one website to monitor.");
      return;
    }
    for (const t of targets) {
      const val = validateMonitorUrl(t.url);
      if (!val.valid) {
        setTargetError(val.error || `Invalid website address: ${t.url}`);
        return;
      }
    }
    setTargetError(null);
    setCurrentStep(3);
  };

  // Step 3: Alert notification validation
  const handleValidateStep3 = () => {
    const trimmed = notifTarget.trim();
    if (!trimmed) {
      setNotifError("Please provide an email or alert address to receive notifications.");
      return;
    }
    if (notifType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setNotifError("Please enter a valid email address.");
      return;
    }
    if ((notifType === "webhook" || notifType === "discord") && !trimmed.startsWith("https://")) {
      setNotifError("Notification address must start with https://");
      return;
    }
    setNotifError(null);
    setCurrentStep(4);
  };

  // Step 4: Provision & Start Monitor
  const handleLaunch = async () => {
    const domainVal = validateSubdomain(subdomain);
    if (!domainVal.valid) {
      setLaunchError(domainVal.error || "Please enter a valid web address.");
      return;
    }

    setIsLaunching(true);
    setLaunchError(null);
    setLaunchPhase(1);

    try {
      const phaseTimer1 = setTimeout(() => setLaunchPhase(2), 1200);
      const phaseTimer2 = setTimeout(() => setLaunchPhase(3), 2500);

      const res = await fetch("/api/recipes/uptime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || `${subdomain} Status`,
          subdomain: subdomain.trim().toLowerCase(),
          isPublic,
          targets: targets.map((t) => ({
            url: t.url.trim(),
            name: t.name ? t.name.trim() : new URL(t.url).hostname,
            intervalSeconds: t.intervalSeconds || 60,
          })),
          notification: {
            type: notifType,
            target: notifTarget.trim(),
          },
        }),
      });

      clearTimeout(phaseTimer1);
      clearTimeout(phaseTimer2);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not launch uptime monitor. Please try again.");
      }

      setLaunchSuccess(true);
      setStatusPageUrl(data.statusPageUrl || `https://${subdomain}.status.ingr.app`);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : "Failed to launch monitor.");
    } finally {
      setIsLaunching(false);
    }
  };

  const copyToClipboard = () => {
    if (statusPageUrl) {
      navigator.clipboard.writeText(statusPageUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-5 md:p-10 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Link
          href="/protected/recipes"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Recipes
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Free Uptime Monitor</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Set up 24/7 automated checks and a public status page in minutes.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full border border-border w-fit shrink-0">
            <ShieldCheck size={14} className="text-green-500" />
            <span>Encrypted via Vault</span>
          </div>
        </div>
      </div>

      {/* Progress Steps Indicator */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4">
        {[
          { step: 1, label: "Connect Cloud", desc: "Oracle Cloud" },
          { step: 2, label: "Websites", desc: "Monitored URLs" },
          { step: 3, label: "Alerts", desc: "Notifications" },
          { step: 4, label: "Go Live", desc: "Status Page" },
        ].map((item) => {
          const isDone = currentStep > item.step || launchSuccess;
          const isCurrent = currentStep === item.step && !launchSuccess;

          return (
            <button
              key={item.step}
              type="button"
              disabled={item.step > currentStep && !launchSuccess}
              onClick={() => {
                if (item.step < currentStep && !isLaunching) {
                  setCurrentStep(item.step as WizardStep);
                }
              }}
              className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                isCurrent
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : isDone
                  ? "border-border bg-card/60 hover:bg-card"
                  : "border-border/40 bg-muted/20 opacity-60 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                    isDone
                      ? "bg-green-500 text-white"
                      : isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check size={12} /> : item.step}
                </span>
                <span className="text-xs font-semibold truncate hidden sm:inline">{item.label}</span>
              </div>
              <span className="text-[11px] text-muted-foreground truncate">{item.desc}</span>
            </button>
          );
        })}
      </div>

      {/* STEP 1: Connect Oracle Cloud */}
      {currentStep === 1 && !launchSuccess && (
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 flex flex-col gap-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Server size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Step 1: Connect Oracle Cloud Always Free</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                INGR runs your private Uptime Kuma instance inside Oracle Cloud&apos;s Always Free compute tier. Your credentials stay strictly isolated in your private vault.
              </p>
            </div>
          </div>

          {isCheckingAccount ? (
            <div className="flex items-center justify-center py-12 gap-3 text-sm text-muted-foreground">
              <Loader2 className="animate-spin h-5 w-5 text-primary" />
              <span>Checking your connected accounts...</span>
            </div>
          ) : isConnected ? (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-green-700 dark:text-green-300">
                <CheckCircle2 size={20} className="text-green-500 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Oracle Cloud Connected</p>
                  <p className="text-xs opacity-90 mt-0.5">
                    Your compute server credentials are valid and ready.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                Continue to Websites
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleConnectService} className="flex flex-col gap-5 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">User OCID</label>
                  <input
                    type="text"
                    value={oracleUserOcid}
                    onChange={(e) => setOracleUserOcid(e.target.value)}
                    placeholder="ocid1.user.oc1..aaaa..."
                    className="h-10 px-3.5 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Tenancy OCID</label>
                  <input
                    type="text"
                    value={oracleTenancyOcid}
                    onChange={(e) => setOracleTenancyOcid(e.target.value)}
                    placeholder="ocid1.tenancy.oc1..aaaa..."
                    className="h-10 px-3.5 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Key Fingerprint</label>
                  <input
                    type="text"
                    value={oracleFingerprint}
                    onChange={(e) => setOracleFingerprint(e.target.value)}
                    placeholder="12:34:56:78:90:ab:cd:ef..."
                    className="h-10 px-3.5 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Private Key (PEM)</label>
                  <input
                    type="password"
                    value={oraclePrivateKey}
                    onChange={(e) => setOraclePrivateKey(e.target.value)}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                    className="h-10 px-3.5 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {accountError && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{accountError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsConnected(true);
                    setCurrentStep(2);
                  }}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Use hermetic test mode &rarr;
                </button>
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      Save & Connect
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* STEP 2: Websites to Monitor */}
      {currentStep === 2 && !launchSuccess && (
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 flex flex-col gap-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Globe size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Step 2: Choose Websites to Monitor</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Enter the web addresses you want checked every 60 seconds for downtime or performance dips.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {targets.map((t, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 rounded-xl border border-border bg-background"
              >
                <div className="flex-1">
                  <input
                    type="text"
                    value={t.name}
                    onChange={(e) => handleUpdateTarget(idx, "name", e.target.value)}
                    placeholder="Website Label (e.g. My Blog)"
                    className="w-full h-9 px-3 rounded-md border border-input text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex-[2]">
                  <input
                    type="url"
                    value={t.url}
                    onChange={(e) => handleUpdateTarget(idx, "url", e.target.value)}
                    placeholder="https://example.com"
                    className="w-full h-9 px-3 rounded-md border border-input text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveTarget(idx)}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10 shrink-0 self-end sm:self-center"
                  title="Remove website"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddTarget}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline w-fit"
          >
            <Plus size={14} /> Add another website
          </button>

          {targetError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{targetError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-4 text-xs font-medium hover:bg-accent transition-colors"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              onClick={handleValidateStep2}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              Continue to Alerts
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Alerts & Notification Channel */}
      {currentStep === 3 && !launchSuccess && (
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 flex flex-col gap-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Bell size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Step 3: Alert Destinations</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Where should we notify you the instant any monitored website goes down?
              </p>
            </div>
          </div>

          {/* Channel selector */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { type: "email" as const, label: "Email Alert", icon: Mail },
              { type: "discord" as const, label: "Discord Webhook", icon: MessageSquare },
              { type: "webhook" as const, label: "Custom Webhook", icon: Zap },
            ].map((c) => {
              const Icon = c.icon;
              const isSelected = notifType === c.type;
              return (
                <button
                  key={c.type}
                  type="button"
                  onClick={() => {
                    setNotifType(c.type);
                    setNotifError(null);
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                      : "border-border bg-background hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-xs font-semibold text-foreground">{c.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              {notifType === "email" ? "Alert Email Address" : "Notification Webhook Address"}
            </label>
            <input
              type={notifType === "email" ? "email" : "url"}
              value={notifTarget}
              onChange={(e) => {
                setNotifTarget(e.target.value);
                setNotifError(null);
              }}
              placeholder={
                notifType === "email"
                  ? "alerts@yourdomain.com"
                  : "https://discord.com/api/webhooks/..."
              }
              className="h-10 px-3.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {notifError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{notifError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-4 text-xs font-medium hover:bg-accent transition-colors"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              onClick={handleValidateStep3}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              Continue to Go Live
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Web Address & 1-Click Launch */}
      {currentStep === 4 && !launchSuccess && (
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 flex flex-col gap-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <MonitorPlay size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Step 4: Status Page Address & Launch</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Choose a public address for your live status page and start 24/7 monitoring.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">Monitor Instance Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production Status Page"
                className="h-10 px-3.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">Web Address (Subdomain)</label>
              <div className="flex items-center rounded-lg border border-input bg-background px-3.5 h-10 focus-within:ring-2 focus-within:ring-primary/20">
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="mystatus"
                  className="flex-1 bg-transparent text-sm focus:outline-none font-mono"
                  disabled={isLaunching}
                />
                <span className="text-xs text-muted-foreground font-mono">.status.ingr.app</span>
              </div>
            </div>
          </div>

          {/* Community Template Sharing Toggle */}
          <div className="rounded-xl border border-border/80 bg-background p-4 flex items-center justify-between">
            <div className="space-y-0.5 pr-4">
              <span className="text-xs font-semibold text-foreground">Make this uptime monitor a public template?</span>
              <p className="text-[11px] text-muted-foreground leading-normal">
                If enabled, others in the community can use your monitoring setup as a starter recipe template. If kept private, it remains visible only to you.
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

          {/* Configuration Summary Card */}
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 flex flex-col gap-2 text-xs">
            <p className="font-semibold text-foreground">Setup Summary:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
              <div>
                &bull; Monitoring: <span className="font-medium text-foreground">{targets.length} website(s)</span>
              </div>
              <div>
                &bull; Alerts sent via: <span className="font-medium text-foreground">{notifType}</span>
              </div>
              <div>
                &bull; Check Frequency: <span className="font-medium text-foreground">Every 60 seconds</span>
              </div>
              <div>
                &bull; Cost: <span className="font-medium text-green-600 dark:text-green-400">100% Free Always</span>
              </div>
            </div>
          </div>

          {isLaunching && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Loader2 size={14} className="animate-spin" />
                {launchPhase === 1 && "Starting Oracle Cloud compute container..."}
                {launchPhase === 2 && "Registering targets in Uptime Kuma..."}
                {launchPhase === 3 && "Publishing public status page..."}
              </div>
              <div className="w-full bg-primary/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-700"
                  style={{ width: `${launchPhase * 33}%` }}
                />
              </div>
            </div>
          )}

          {launchError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{launchError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <button
              type="button"
              disabled={isLaunching}
              onClick={() => setCurrentStep(3)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-4 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              disabled={isLaunching}
              onClick={handleLaunch}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  Start 24/7 Monitoring
                  <Zap className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS SCREEN */}
      {launchSuccess && statusPageUrl && (
        <div className="rounded-2xl border border-green-500/30 bg-card p-6 md:p-10 flex flex-col items-center text-center gap-6 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 text-green-500 flex items-center justify-center">
            <CheckCircle2 size={36} />
          </div>
          <div className="max-w-md">
            <h2 className="text-2xl font-bold tracking-tight">Your Uptime Monitor is Live!</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Your websites are now monitored around the clock. Your public status page is live and ready to share with customers.
            </p>
          </div>

          <div className="w-full max-w-lg rounded-xl border border-border bg-secondary/30 p-4 flex items-center justify-between gap-3">
            <a
              href={statusPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono font-medium text-primary hover:underline truncate"
            >
              {statusPageUrl}
            </a>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={copyToClipboard}
                className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Copy web address"
              >
                {copiedUrl ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
              <a
                href={statusPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Open status page"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/protected/recipes"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              View in Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
