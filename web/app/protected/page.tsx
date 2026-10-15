import { createClient, DEFAULT_INSTANCE_USER } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Plus, ArrowRight, Activity, Cloud, Database, MonitorPlay, Zap } from "lucide-react";
import Link from "next/link";

export default async function ProtectedPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user || DEFAULT_INSTANCE_USER;

  if (!user) {
    redirect("/auth/login");
  }

  const userEmail = user.email;
  const userName = user.user_metadata?.name || userEmail?.split("@")[0] || "Builder";

  return (
    <div className="w-full max-w-7xl p-5 md:p-10 flex flex-col gap-12">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/50 pb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Welcome back, {userName}
          </h1>
          <p className="text-muted-foreground text-lg">
            Here&apos;s an overview of your recipes and connected services.
          </p>
        </div>
        <Link 
          href="/protected/recipes/new" 
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm"
        >
          <Plus className="mr-2 h-4 w-4" /> New Recipe
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Column (Recipes) */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="text-primary" size={24} /> Your Recipes
            </h2>
            <Link href="/protected/recipes" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>

          {/* Empty State for Recipes */}
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6">
              <Activity size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2">No active recipes</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              You haven&apos;t activated any recipes yet. Recipes combine free internet services to solve specific problems for your business.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full text-left">
              <Link href="/protected/recipes/new?type=hosting" className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm">
                <div className="font-semibold mb-1 group-hover:text-primary transition-colors">Free Website Hosting</div>
                <div className="text-sm text-muted-foreground">Publish to Cloudflare Pages</div>
              </Link>
              <Link href="/protected/recipes/new?type=uptime" className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm">
                <div className="font-semibold mb-1 group-hover:text-primary transition-colors">Uptime Monitor</div>
                <div className="text-sm text-muted-foreground">Hosted on Oracle Cloud</div>
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar Column (Services) */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Connected Services</h2>
            <Link href="/protected/services" className="text-sm font-medium text-primary hover:underline">
              Manage
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm divide-y divide-border overflow-hidden">
            {/* Supabase - usually connected automatically via login if they use magic link or OAuth, but let's show an empty state or partial */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center text-muted-foreground">
                  <Cloud size={20} />
                </div>
                <div>
                  <div className="font-medium">Cloudflare</div>
                  <div className="text-xs text-muted-foreground">Not connected</div>
                </div>
              </div>
              <Link href="/protected/services/connect?service=cloudflare" className="text-xs font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-1.5 rounded-md transition-colors">
                Connect
              </Link>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center text-muted-foreground">
                  <Database size={20} />
                </div>
                <div>
                  <div className="font-medium">Supabase</div>
                  <div className="text-xs text-muted-foreground">Not connected</div>
                </div>
              </div>
              <Link href="/protected/services/connect?service=supabase" className="text-xs font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-1.5 rounded-md transition-colors">
                Connect
              </Link>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center text-muted-foreground">
                  <MonitorPlay size={20} />
                </div>
                <div>
                  <div className="font-medium">Oracle Cloud</div>
                  <div className="text-xs text-muted-foreground">Not connected</div>
                </div>
              </div>
              <Link href="/protected/services/connect?service=oracle" className="text-xs font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground px-3 py-1.5 rounded-md transition-colors">
                Connect
              </Link>
            </div>
            
            <div className="p-4 bg-muted/30 text-center">
              <Link href="/protected/services" className="text-sm font-medium text-primary hover:underline inline-flex items-center">
                View all 12 supported services <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
