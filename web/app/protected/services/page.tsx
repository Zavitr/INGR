"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Cloud, 
  Database, 
  MonitorPlay, 
  Code, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  ExternalLink,
  Layers
} from "lucide-react";
import { ConnectServiceCard } from "@/components/services/connect-service-card";
import { Input } from "@/components/ui/input";

interface PieceItem {
  name: string;
  displayName: string;
  description: string;
  logoUrl?: string;
  version: string;
  categories?: string[];
}

const CATEGORIES = [
  "All",
  "AI & Machine Learning",
  "Gaming & Esports",
  "Social & Creators",
  "Creative & 3D Design",
  "Communication",
  "Developer & Cloud",
  "Databases & Storage",
  "Business & Finance",
  "Productivity",
];

export default function ServicesPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<Record<string, boolean>>({
    supabase: false,
    cloudflare: false,
    openrouter: false,
    oracle: false,
  });
  const [actionError, setActionError] = useState<string | null>(null);

  // Search & Catalog state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [pieces, setPieces] = useState<PieceItem[]>([]);
  const [totalPieces, setTotalPieces] = useState(0);
  const [isLoadingPieces, setIsLoadingPieces] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/services");
      if (res.ok) {
        const data = await res.json();
        if (data.services) {
          setConnections(data.services);
        }
      }
    } catch (err) {
      console.error("Failed to fetch service status:", err);
    }
  }, []);

  const fetchCatalog = useCallback(async (query: string, cat: string, append = false, currentOffset = 0) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingPieces(true);
    }
    try {
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      if (cat !== "All") params.set("category", cat);
      params.set("limit", "120");
      params.set("offset", currentOffset.toString());

      const res = await fetch(`/api/pieces?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPieces((prev) => append ? [...prev, ...(data.pieces || [])] : (data.pieces || []));
        setTotalPieces(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load connectors catalog:", err);
    } finally {
      setIsLoadingPieces(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
    fetchCatalog("", "All", false, 0);

    const handleFocus = () => fetchConnections();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchConnections();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchConnections, fetchCatalog]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCatalog(searchQuery, selectedCategory, false, 0);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, fetchCatalog]);

  const handleDisconnect = async (serviceId: string) => {
    setActionError(null);
    try {
      const res = await fetch("/api/services", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: serviceId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to disconnect ${serviceId}`);
      }

      setConnections((prev) => ({
        ...prev,
        [serviceId]: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disconnect service";
      setActionError(message);
      throw err;
    }
  };

  const handleConnect = (serviceId: string) => {
    router.push(`/protected/services/connect?service=${serviceId}`);
  };

  return (
    <div className="w-full max-w-7xl p-5 md:p-10 flex flex-col gap-10 mx-auto">
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Connected Services & Integrations</h1>
            <p className="text-muted-foreground mt-1 text-lg">
              Connect external tools once to use them across any recipe. Powered by our engine of over {totalPieces > 0 ? totalPieces.toLocaleString() : "4,700"}+ open connectors and public APIs.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium w-fit">
            <Sparkles size={16} /> {totalPieces > 0 ? totalPieces.toLocaleString() : "4,700"}+ Ready Integrations
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {actionError}
        </div>
      )}

      {/* Core Launch Services */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Layers size={18} className="text-primary" />
          <h2 className="text-xl font-semibold tracking-tight">Core Cloud Infrastructure</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ConnectServiceCard
            id="cloudflare"
            name="Cloudflare"
            description="Free web hosting (Pages), DNS, and global CDN. Powers static site recipes."
            icon={<Cloud size={24} />}
            isConnected={connections.cloudflare}
            onConnect={() => handleConnect("cloudflare")}
            onReconnect={() => handleConnect("cloudflare")}
            onDisconnect={() => handleDisconnect("cloudflare")}
            signupUrl="https://dash.cloudflare.com/sign-up"
          />

          <ConnectServiceCard
            id="supabase"
            name="Supabase"
            description="Free PostgreSQL database, user auth, and file storage. Powers database recipes."
            icon={<Database size={24} />}
            isConnected={connections.supabase}
            onConnect={() => handleConnect("supabase")}
            onReconnect={() => handleConnect("supabase")}
            onDisconnect={() => handleDisconnect("supabase")}
            signupUrl="https://supabase.com/dashboard/sign-up"
          />

          <ConnectServiceCard
            id="openrouter"
            name="OpenRouter"
            description="Access dozens of free AI models (Llama, Mistral, Gemma) with zero card required."
            icon={<Code size={24} />}
            isConnected={connections.openrouter}
            onConnect={() => handleConnect("openrouter")}
            onReconnect={() => handleConnect("openrouter")}
            onDisconnect={() => handleDisconnect("openrouter")}
            signupUrl="https://openrouter.ai/sign-up"
          />

          <ConnectServiceCard
            id="oracle"
            name="Oracle Cloud"
            description="Free compute VM hosting for continuous monitoring and background tasks."
            icon={<MonitorPlay size={24} />}
            isConnected={connections.oracle}
            onConnect={() => handleConnect("oracle")}
            onReconnect={() => handleConnect("oracle")}
            onDisconnect={() => handleDisconnect("oracle")}
            signupUrl="https://www.oracle.com/cloud/free/"
          />
        </div>
      </div>

      {/* Search & Directory Section */}
      <div className="pt-6 border-t border-border flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Service Catalog & Integrations</h2>
            <p className="text-muted-foreground text-sm">
              Discover tools to connect to your recipes, webhooks, and automation pipelines.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Search 4,760+ services & APIs (e.g. Chess.com, Supercell, Fortnite)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Categories Pills */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Catalog Grid */}
        {isLoadingPieces ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl border border-border/40 bg-card/40 animate-pulse p-4 flex flex-col justify-between">
                <div className="h-5 w-24 bg-muted rounded" />
                <div className="h-3 w-full bg-muted/60 rounded" />
                <div className="h-3 w-2/3 bg-muted/60 rounded" />
              </div>
            ))}
          </div>
        ) : pieces.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            No integrations found matching &ldquo;{searchQuery}&rdquo;. Try another term.
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {pieces.map((piece) => {
                const isDirectlyConnected =
                  (piece.displayName.toLowerCase().includes("cloudflare") && connections.cloudflare) ||
                  (piece.displayName.toLowerCase().includes("supabase") && connections.supabase) ||
                  (piece.displayName.toLowerCase().includes("openrouter") && connections.openrouter) ||
                  (piece.displayName.toLowerCase().includes("oracle") && connections.oracle);

                return (
                  <div
                    key={piece.name}
                    className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between hover:border-primary/40 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        {piece.logoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={piece.logoUrl}
                            alt={piece.displayName}
                            className="w-7 h-7 rounded object-contain shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-7 h-7 rounded bg-primary/10 text-primary flex items-center justify-center text-xs font-bold uppercase shrink-0">
                            {piece.displayName.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-1">
                            {piece.displayName}
                          </h3>
                          {piece.categories?.[0] && (
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                              {piece.categories[0]}
                            </span>
                          )}
                        </div>
                      </div>
                      {isDirectlyConnected && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                      {piece.description}
                    </p>

                    <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground text-[11px]">Ready for Recipes</span>
                      <button
                        onClick={() => handleConnect(piece.displayName.toLowerCase())}
                        className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                      >
                        Use in Recipe <ExternalLink size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {pieces.length < totalPieces && (
              <div className="flex flex-col items-center justify-center pt-4 pb-2 gap-2">
                <p className="text-xs text-muted-foreground">
                  Showing {pieces.length.toLocaleString()} of {totalPieces.toLocaleString()} integrations
                </p>
                <button
                  type="button"
                  onClick={() => fetchCatalog(searchQuery, selectedCategory, true, pieces.length)}
                  disabled={isLoadingMore}
                  className="px-6 py-2.5 text-sm font-medium rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all shadow-sm hover:shadow disabled:opacity-50"
                >
                  {isLoadingMore ? "Loading more integrations..." : "Load More Integrations"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
