import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { CrispChat } from "@/components/crisp-chat";
import { Layers } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center bg-background text-foreground">
      <div className="flex-1 w-full flex flex-col items-center">
        {/* Dashboard Navigation */}
        <nav className="w-full flex justify-center border-b border-b-foreground/5 h-16 sticky top-0 bg-background/95 backdrop-blur z-50">
          <div className="w-full max-w-7xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-4 sm:gap-8 items-center font-semibold">
              <Link href={"/protected"} className="flex gap-2 items-center text-lg tracking-tight hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                  <Layers size={18} />
                </div>
                INGR
              </Link>
              <div className="flex items-center gap-3 sm:gap-6 text-muted-foreground font-medium text-xs sm:text-sm">
                <Link href="/protected" className="hover:text-foreground transition-colors">Dashboard</Link>
                <Link href="/protected/recipes" className="hover:text-foreground transition-colors">Recipes</Link>
                <Link href="/protected/services" className="hover:text-foreground transition-colors">Services</Link>
                <Link href="/protected/settings" className="hover:text-foreground transition-colors">Settings</Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Suspense fallback={<div className="h-9 w-20 bg-muted animate-pulse rounded-md" />}>
                <AuthButton />
              </Suspense>
            </div>
          </div>
        </nav>
        
        {/* Main Content Area */}
        <div className="flex-1 w-full flex justify-center">
          {children}
        </div>

        {/* Dashboard Footer */}
        <footer className="w-full flex flex-col items-center justify-center border-t border-border/40 mx-auto text-center text-xs gap-3 py-8 text-muted-foreground">
          <div className="flex items-center gap-8">
            <p>&copy; 2026 INGR Platform</p>
            <div className="flex gap-4">
              <Link href="#" className="hover:text-foreground transition-colors">Support</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Documentation</Link>
            </div>
            <ThemeSwitcher />
          </div>
          <p className="text-[11px] text-muted-foreground/60 max-w-2xl px-4">
            Third-party trademarks and logos belong to their respective owners. Integrations are independent connectors and do not imply endorsement or affiliation.
          </p>
        </footer>
      </div>
      <CrispChat />
    </main>
  );
}
