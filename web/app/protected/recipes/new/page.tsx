import { createClient, DEFAULT_INSTANCE_USER } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  ArrowRight, 
  Clock, 
  Cloud, 
  Code, 
  Database, 
  Globe, 
  MonitorPlay, 
  PlusCircle, 
  ShieldCheck, 
  Sparkles, 
  Zap 
} from "lucide-react";
import { HostingWizard } from "@/components/recipes/hosting-wizard";
import { UptimeWizard } from "@/components/recipes/uptime-wizard";

interface RecipeTemplate {
  id: string;
  name: string;
  description: string;
  category: "Websites" | "Monitoring" | "Backups" | "AI" | "Creative" | "Gaming" | "Custom";
  services: { name: string; icon: string }[];
  setupTime: string;
  popular?: boolean;
}

const TEMPLATES: RecipeTemplate[] = [
  {
    id: "hosting",
    name: "Free Website Hosting",
    description: "Publish your static website or portfolio with automatic security and global delivery.",
    category: "Websites",
    services: [{ name: "Cloudflare Pages", icon: "cloud" }],
    setupTime: "2 min",
    popular: true,
  },
  {
    id: "uptime",
    name: "Free Uptime Monitor",
    description: "Get alerts via email or Slack the instant your website goes offline.",
    category: "Monitoring",
    services: [
      { name: "Oracle Cloud", icon: "monitor" },
      { name: "Uptime Kuma", icon: "zap" },
    ],
    setupTime: "3 min",
    popular: true,
  },
  {
    id: "chatbot",
    name: "Free AI Chatbot Widget",
    description: "Add an intelligent, customized AI assistant to your website using open models.",
    category: "AI",
    services: [
      { name: "OpenRouter", icon: "code" },
      { name: "Cloudflare Workers", icon: "cloud" },
    ],
    setupTime: "4 min",
  },
  {
    id: "chess-puzzle",
    name: "Daily Chess Puzzle to Community Channels",
    description: "Automatically fetch Chess.com's daily tactics puzzle every morning and post the diagram and solution to Discord or Telegram.",
    category: "Gaming",
    services: [
      { name: "Chess.com", icon: "zap" },
      { name: "Community Channels", icon: "cloud" },
    ],
    setupTime: "2 min",
  },
  {
    id: "game-server-backup",
    name: "Minecraft & Game Server World Backups",
    description: "Take scheduled snapshots of Minecraft/game server worlds and sync them securely into zero-fee Cloudflare R2 storage.",
    category: "Gaming",
    services: [
      { name: "Minecraft Server", icon: "monitor" },
      { name: "Cloudflare R2", icon: "cloud" },
    ],
    setupTime: "3 min",
  },
  {
    id: "contact-form",
    name: "Free Contact Form Backend",
    description: "Receive form submissions on any website, save messages, and get notified immediately.",
    category: "Websites",
    services: [
      { name: "Supabase", icon: "database" },
      { name: "Email Notifications", icon: "zap" },
    ],
    setupTime: "3 min",
  },
  {
    id: "3d-render",
    name: "Headless 3D Render & Video Export",
    description: "Trigger cloud Blender 3D render jobs automatically and publish results directly to cloud storage or media channels.",
    category: "Creative",
    services: [
      { name: "Blender 3D", icon: "sparkles" },
      { name: "Cloud Storage", icon: "cloud" },
    ],
    setupTime: "3 min",
  },
  {
    id: "photoshop-banner",
    name: "Automated Social Graphics with Photoshop",
    description: "Generate customized high-resolution banners and assets via Adobe Photoshop Cloud APIs from database content.",
    category: "Creative",
    services: [
      { name: "Adobe Photoshop", icon: "sparkles" },
      { name: "Social Channels", icon: "zap" },
    ],
    setupTime: "3 min",
  },
  {
    id: "dns-backup",
    name: "Backup Cloudflare Web Addresses to Supabase",
    description: "Automatically back up your web address settings daily into secure database tables.",
    category: "Backups",
    services: [
      { name: "Cloudflare", icon: "cloud" },
      { name: "Supabase", icon: "database" },
    ],
    setupTime: "2 min",
  },
  {
    id: "db-storage-sync",
    name: "Sync Database to Storage",
    description: "Keep automated snapshots of your data safely stored in zero-fee cloud storage.",
    category: "Backups",
    services: [
      { name: "Supabase", icon: "database" },
      { name: "Cloudflare R2", icon: "cloud" },
    ],
    setupTime: "3 min",
  },
  {
    id: "custom",
    name: "Custom Recipe Builder",
    description: "Combine any of your connected services together into a personalized automated solution.",
    category: "Custom",
    services: [
      { name: "Connected Services", icon: "sparkles" },
    ],
    setupTime: "Flexible",
  },
];

function renderServiceIcon(icon: string) {
  switch (icon) {
    case "cloud":
      return <Cloud size={14} className="text-primary" />;
    case "database":
      return <Database size={14} className="text-primary" />;
    case "monitor":
      return <MonitorPlay size={14} className="text-primary" />;
    case "code":
      return <Code size={14} className="text-primary" />;
    case "sparkles":
      return <Sparkles size={14} className="text-primary" />;
    default:
      return <Zap size={14} className="text-primary" />;
  }
}

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user || DEFAULT_INSTANCE_USER;

  if (!user) {
    redirect("/auth/login");
  }

  const { type } = await searchParams;

  // Render dedicated hosting wizard when type=hosting
  if (type === "hosting") {
    return <HostingWizard />;
  }

  // Render dedicated uptime wizard when type=uptime
  if (type === "uptime") {
    return <UptimeWizard />;
  }

  return (
    <div className="w-full max-w-6xl p-5 md:p-10 flex flex-col gap-10 mx-auto">
      {/* Header and Back Link */}
      <div className="flex flex-col gap-4">
        <Link 
          href="/protected/recipes" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Recipes
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/50 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create a Recipe</h1>
            <p className="text-muted-foreground mt-1 text-lg">
              Choose a guided recipe wizard or select a starter recipe from connected services.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border w-fit">
            <ShieldCheck size={14} className="text-green-500" />
            <span>Encrypted credentials via vault</span>
          </div>
        </div>
      </div>

      {/* Starter Recipe Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TEMPLATES.map((template) => {
          const isSelected = type === template.id;
          const targetUrl =
            template.id === "hosting"
              ? "/protected/recipes/new?type=hosting"
              : template.id === "uptime"
              ? "/protected/recipes/new?type=uptime"
              : `/protected/services/connect?recipe=${template.id}`;

          return (
            <div
              key={template.id}
              className={`rounded-2xl border bg-card p-6 shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${
                isSelected 
                  ? "border-primary ring-2 ring-primary/20 bg-primary/[0.02]" 
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {template.category}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-md">
                    <Clock size={12} />
                    <span>{template.setupTime}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    {template.id === "hosting" && <Globe size={20} />}
                    {template.id === "uptime" && <MonitorPlay size={20} />}
                    {template.id === "chatbot" && <Code size={20} />}
                    {template.id === "contact-form" && <Database size={20} />}
                    {template.id === "dns-backup" && <Cloud size={20} />}
                    {template.id === "db-storage-sync" && <Database size={20} />}
                    {template.id === "custom" && <PlusCircle size={20} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight flex items-center gap-2">
                      {template.name}
                      {template.popular && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          Popular
                        </span>
                      )}
                    </h3>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  {template.description}
                </p>
              </div>

              <div>
                <div className="pt-4 border-t border-border/50 mb-6">
                  <p className="text-xs text-muted-foreground font-medium mb-2">Required services:</p>
                  <div className="flex flex-wrap gap-2">
                    {template.services.map((svc, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 text-xs bg-muted px-2.5 py-1 rounded-md text-foreground font-medium"
                      >
                        {renderServiceIcon(svc.icon)}
                        {svc.name}
                      </span>
                    ))}
                  </div>
                </div>

                <Link
                  href={targetUrl}
                  className={`w-full h-10 inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    isSelected || template.id === "hosting"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  Configure Recipe
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
