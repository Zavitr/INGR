"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import {
  ArrowLeft,
  Check,
  Cloud,
  Database,
  ExternalLink,
  Loader2,
  Server,
  Bot,
  Info,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

interface ServiceMeta {
  id: "cloudflare" | "supabase" | "openrouter" | "oracle";
  name: string;
  title: string;
  description: string;
  icon: typeof Cloud;
  signupUrl: string;
  actionUrl: string;
  actionLabel: string;
}

const SERVICES: Record<"cloudflare" | "supabase" | "openrouter" | "oracle", ServiceMeta> = {
  cloudflare: {
    id: "cloudflare",
    name: "Cloudflare",
    title: "Connect Cloudflare",
    description:
      "Cloudflare gives you free website hosting, fast global content delivery, web address management, and automatic security certificates.",
    icon: Cloud,
    signupUrl: "https://dash.cloudflare.com/sign-up",
    actionUrl: "https://dash.cloudflare.com/profile/api-tokens",
    actionLabel: "Create Token in Cloudflare",
  },
  supabase: {
    id: "supabase",
    name: "Supabase",
    title: "Connect Supabase",
    description:
      "Supabase provides a free database, user accounts and authentication, and secure cloud file storage for your recipes.",
    icon: Database,
    signupUrl: "https://supabase.com/dashboard/sign-up",
    actionUrl: "https://supabase.com/dashboard",
    actionLabel: "Open Supabase Dashboard",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    title: "Connect OpenRouter",
    description:
      "OpenRouter gives you instant access to dozens of AI models (including free models like Llama 3 and Mistral) with zero subscriptions or upfront cost.",
    icon: Bot,
    signupUrl: "https://openrouter.ai/sign-up",
    actionUrl: "https://openrouter.ai/keys",
    actionLabel: "Get OpenRouter API Key",
  },
  oracle: {
    id: "oracle",
    name: "Oracle Cloud",
    title: "Connect Oracle Cloud",
    description:
      "Oracle Cloud Always Free provides 2 virtual servers with 24GB memory and 200GB storage to run background tasks for $0 forever.",
    icon: Server,
    signupUrl: "https://www.oracle.com/cloud/free/",
    actionUrl: "https://cloud.oracle.com/",
    actionLabel: "Open Oracle Cloud Console",
  },
};

function ConnectServiceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawService = searchParams.get("service") || "supabase";
  const serviceId = (
    ["cloudflare", "supabase", "openrouter", "oracle"].includes(rawService.toLowerCase())
      ? rawService.toLowerCase()
      : "supabase"
  ) as "cloudflare" | "supabase" | "openrouter" | "oracle";

  const currentService = SERVICES[serviceId];
  const ServiceIcon = currentService.icon;

  // Cloudflare Form State
  const [cloudflareToken, setCloudflareToken] = useState("");

  // Supabase Form State
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseApiKey, setSupabaseApiKey] = useState("");

  // OpenRouter Form State
  const [openrouterApiKey, setOpenrouterApiKey] = useState("");

  // Oracle Cloud Form State
  const [oracleTenancy, setOracleTenancy] = useState("");
  const [oracleUser, setOracleUser] = useState("");
  const [oracleFingerprint, setOracleFingerprint] = useState("");
  const [oracleRegion, setOracleRegion] = useState("us-ashburn-1");
  const [oraclePrivateKey, setOraclePrivateKey] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let payload: Record<string, unknown> = { service: serviceId };

    if (serviceId === "cloudflare") {
      if (!cloudflareToken.trim()) {
        setError("Please enter your Cloudflare API Token.");
        setLoading(false);
        return;
      }
      payload = {
        service: "cloudflare",
        apiToken: cloudflareToken.trim(),
      };
    } else if (serviceId === "supabase") {
      if (!supabaseUrl.trim() || !supabaseApiKey.trim()) {
        setError("Please enter both your Project Web Address (URL) and API Key.");
        setLoading(false);
        return;
      }
      payload = {
        service: "supabase",
        url: supabaseUrl.trim(),
        apiKey: supabaseApiKey.trim(),
      };
    } else if (serviceId === "openrouter") {
      if (!openrouterApiKey.trim()) {
        setError("Please enter your OpenRouter API Key.");
        setLoading(false);
        return;
      }
      payload = {
        service: "openrouter",
        apiKey: openrouterApiKey.trim(),
      };
    } else if (serviceId === "oracle") {
      if (
        !oracleTenancy.trim() ||
        !oracleUser.trim() ||
        !oracleFingerprint.trim() ||
        !oraclePrivateKey.trim()
      ) {
        setError(
          "Please fill in all required Oracle Cloud fields (Tenancy OCID, User OCID, Fingerprint, and Private Key)."
        );
        setLoading(false);
        return;
      }
      payload = {
        service: "oracle",
        credentials: {
          tenancyOcid: oracleTenancy.trim(),
          userOcid: oracleUser.trim(),
          fingerprint: oracleFingerprint.trim(),
          region: oracleRegion.trim() || "us-ashburn-1",
          privateKey: oraclePrivateKey.trim(),
        },
        tenancyOcid: oracleTenancy.trim(),
        userOcid: oracleUser.trim(),
        fingerprint: oracleFingerprint.trim(),
        region: oracleRegion.trim() || "us-ashburn-1",
        privateKey: oraclePrivateKey.trim(),
      };
    }

    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to connect service");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/protected/services");
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We could not verify your connection. Please verify your credentials and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectService = (id: string) => {
    setError(null);
    setSuccess(false);
    router.push(`/protected/services/connect?service=${id}`);
  };

  return (
    <div className="w-full max-w-2xl p-5 md:p-10 mx-auto">
      <Link
        href="/protected/services"
        className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Services
      </Link>

      {/* Service Selector Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 p-1.5 rounded-xl bg-muted/60 border border-border">
        {Object.values(SERVICES).map((item) => {
          const ItemIcon = item.icon;
          const isActive = item.id === serviceId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectService(item.id)}
              className={`flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                isActive
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              <ItemIcon size={16} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <ServiceIcon size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{currentService.title}</h1>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {currentService.description}
            </p>
          </div>
        </div>

        {success ? (
          <div className="p-8 rounded-xl bg-green-500/10 border border-green-500/20 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center">
              <Check size={28} />
            </div>
            <h3 className="text-xl font-bold text-green-600 dark:text-green-400">
              Connected Successfully!
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Your {currentService.name} account is now connected and ready to use in recipes.
              Redirecting back to services...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Cloudflare Dedicated Wizard */}
            {serviceId === "cloudflare" && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Info size={14} /> Step 1: Create an API Token
                    </span>
                    <a
                      href={currentService.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      {currentService.actionLabel}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                    <p>
                      1. Click <strong>&quot;{currentService.actionLabel}&quot;</strong> above to open your Cloudflare dashboard.
                    </p>
                    <p>
                      2. Select <strong>Create Custom Token</strong> (or start with the <strong>Edit Cloudflare Workers</strong> template).
                    </p>
                    <p>
                      3. Grant permissions for <strong>Account: Cloudflare Pages (Edit)</strong> and <strong>Zone: DNS (Edit)</strong>.
                    </p>
                    <p>
                      4. Click <strong>Continue to summary</strong>, then click <strong>Create Token</strong>.
                    </p>
                    <p>
                      5. Copy your new token and paste it into the field below.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Cloudflare API Token</label>
                  <input
                    type="password"
                    placeholder="Paste your Cloudflare API Token..."
                    required
                    value={cloudflareToken}
                    onChange={(e) => setCloudflareToken(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your secret access token from your Cloudflare profile. Kept safe in your encrypted credential vault.
                  </p>
                </div>
              </div>
            )}

            {/* Supabase Dedicated Wizard */}
            {serviceId === "supabase" && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Info size={14} /> Step 1: Find Project Credentials
                    </span>
                    <a
                      href={currentService.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      {currentService.actionLabel}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                    <p>
                      1. Open your project in the <strong>Supabase Dashboard</strong> using the link above.
                    </p>
                    <p>
                      2. In the left navigation menu, click <strong>Project Settings</strong> (gear icon) and select <strong>API</strong>.
                    </p>
                    <p>
                      3. Copy the <strong>Project URL</strong> and paste it into the web address field below.
                    </p>
                    <p>
                      4. Under <strong>Project API keys</strong>, copy your <strong>anon</strong> public key or <strong>service_role</strong> secret key and paste it below.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Project Web Address (URL)</label>
                  <input
                    type="text"
                    placeholder="https://your-project.supabase.co"
                    required
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    Found in your Supabase project settings under API.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Project Secret Key (API Key)</label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                    required
                    value={supabaseApiKey}
                    onChange={(e) => setSupabaseApiKey(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your anon public key or service_role secret key. Kept safe in your encrypted credential vault.
                  </p>
                </div>
              </div>
            )}

            {/* OpenRouter Dedicated Wizard (Cline Pattern) */}
            {serviceId === "openrouter" && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                        Free Models Available
                      </span>
                    </div>
                    <a
                      href={currentService.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      {currentService.actionLabel}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    You can use completely free models (such as Llama 3 and Mistral) with zero credits required.
                    Paid models can also be used if you choose to add credits later.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">OpenRouter Secret Key</label>
                  <input
                    type="password"
                    placeholder="sk-or-v1-..."
                    required
                    value={openrouterApiKey}
                    onChange={(e) => setOpenrouterApiKey(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Begins with sk-or-v1-... Kept safe in your encrypted credential vault.
                  </p>
                </div>
              </div>
            )}

            {/* Oracle Cloud Dedicated Wizard */}
            {serviceId === "oracle" && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Info size={14} /> Guided Setup for Always Free Compute
                    </span>
                    <a
                      href={currentService.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      {currentService.actionLabel}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                    <p>
                      1. Sign in to your <strong>Oracle Cloud Console</strong> at cloud.oracle.com.
                    </p>
                    <p>
                      2. Click the <strong>User avatar</strong> in the top right and choose <strong>User Settings</strong>.
                    </p>
                    <p>
                      3. Under <strong>Resources</strong> on the left, select <strong>API Keys</strong> and click <strong>Add API Key</strong>.
                    </p>
                    <p>
                      4. Click <strong>Download Private Key</strong> (save the .pem file), then click <strong>Add</strong>.
                    </p>
                    <p>
                      5. Oracle displays a <strong>Configuration File Preview</strong>. Copy each value into the fields below, and paste the private key text.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Tenancy OCID</label>
                    <input
                      type="text"
                      placeholder="ocid1.tenancy.oc1..aaaa..."
                      required
                      value={oracleTenancy}
                      onChange={(e) => setOracleTenancy(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">Starts with ocid1.tenancy.oc1..</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">User OCID</label>
                    <input
                      type="text"
                      placeholder="ocid1.user.oc1..aaaa..."
                      required
                      value={oracleUser}
                      onChange={(e) => setOracleUser(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">Starts with ocid1.user.oc1..</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Key Fingerprint</label>
                    <input
                      type="text"
                      placeholder="12:34:56:78:90:ab:cd:ef:..."
                      required
                      value={oracleFingerprint}
                      onChange={(e) => setOracleFingerprint(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">Fingerprint of your API key</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Home Region</label>
                    <input
                      type="text"
                      placeholder="us-ashburn-1"
                      required
                      value={oracleRegion}
                      onChange={(e) => setOracleRegion(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">e.g. us-ashburn-1, eu-frankfurt-1</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Private Key (.pem contents)</label>
                  <textarea
                    rows={4}
                    placeholder={"-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"}
                    required
                    value={oraclePrivateKey}
                    onChange={(e) => setOraclePrivateKey(e.target.value)}
                    className="w-full p-3 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary font-mono leading-relaxed"
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste the entire text from your downloaded private key file including header and footer.
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 space-y-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 inline-flex items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying Connection...
                  </>
                ) : (
                  `Save & Connect ${currentService.name}`
                )}
              </button>

              <div className="text-center pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Don&apos;t have an account yet?{" "}
                  <a
                    href={currentService.signupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Get a free account
                    <ExternalLink size={12} />
                  </a>
                </p>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ConnectServicePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-muted-foreground">Loading connection wizard...</div>}>
      <ConnectServiceContent />
    </Suspense>
  );
}
