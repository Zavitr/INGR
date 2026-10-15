import Link from "next/link";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ArrowRight, CheckCircle2, Cloud, Code, Database, Globe, Layers, MonitorSmartphone, Shield, Zap } from "lucide-react";
import { Suspense } from "react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center bg-background text-foreground selection:bg-primary/20">
      {/* Navigation */}
      <nav className="w-full flex justify-center border-b border-b-foreground/5 h-16 sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="w-full max-w-7xl flex justify-between items-center p-3 px-5 text-sm">
          <div className="flex gap-2 items-center font-bold text-lg tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <Layers size={18} />
            </div>
            INGR
          </div>
          <div className="flex items-center gap-4">
            <Link href="#recipes" className="hidden sm:block text-muted-foreground hover:text-foreground transition-colors">Recipes</Link>
            <Link href="#pricing" className="hidden sm:block text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Suspense fallback={<div className="h-9 w-20 bg-muted animate-pulse rounded-md" />}>
              <AuthButton />
            </Suspense>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="w-full max-w-7xl px-5 pt-32 pb-20 flex flex-col items-center text-center gap-8 relative overflow-hidden">
        {/* Abstract Background Blurs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none -z-10" />
        
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
          <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
          Now in open beta
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl leading-[1.1]">
          Free internet services, <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
            simplified.
          </span>
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
          Cloudflare, Supabase, and Oracle give away powerful infrastructure for free. 
          We connect them into one-click recipes so you can build your business without code or $200/mo SaaS bills.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full sm:w-auto">
          <Link 
            href="/auth/sign-up" 
            className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-lg shadow-primary/20"
          >
            Start building for free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link 
            href="#recipes" 
            className="inline-flex h-12 items-center justify-center rounded-lg border border-input bg-background px-8 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View recipes
          </Link>
        </div>

        {/* Feature logos */}
        <div className="mt-16 pt-8 border-t border-border/50 w-full max-w-3xl flex flex-col gap-6">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Connects with generous free tiers</p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="flex items-center gap-2 font-semibold text-lg"><Cloud /> Cloudflare</div>
            <div className="flex items-center gap-2 font-semibold text-lg"><Database /> Supabase</div>
            <div className="flex items-center gap-2 font-semibold text-lg"><Code /> OpenRouter</div>
          </div>
        </div>
      </section>

      {/* Recipes Section */}
      <section id="recipes" className="w-full bg-muted/30 py-24 border-y border-border/50">
        <div className="w-full max-w-7xl mx-auto px-5 flex flex-col items-center gap-12">
          <div className="text-center max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Recipes over raw power</h2>
            <p className="text-muted-foreground text-lg">
              Don&apos;t build complex workflows from scratch. Pick a pre-built combination of services that solves your exact problem.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {/* Recipe 1 */}
            <div className="group relative rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 transition-transform group-hover:scale-110" />
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                <Globe size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Free Website Hosting</h3>
              <p className="text-muted-foreground mb-6">
                Publish your website to Cloudflare Pages with automatic security. No server management required.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">Cloudflare Pages</span>
              </div>
              <Link href="/auth/sign-up" className="text-sm font-medium text-primary flex items-center group-hover:underline">
                Use this recipe <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>

            {/* Recipe 2 */}
            <div className="group relative rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 transition-transform group-hover:scale-110" />
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                <MonitorSmartphone size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Free Uptime Monitor</h3>
              <p className="text-muted-foreground mb-6">
                Get notified immediately via email or Slack if your website goes down. Hosted on Oracle Cloud.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">Oracle Cloud</span>
                <span className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">Uptime Kuma</span>
              </div>
              <Link href="/auth/sign-up" className="text-sm font-medium text-primary flex items-center group-hover:underline">
                Use this recipe <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>

            {/* Recipe 3 */}
            <div className="group relative rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 transition-transform group-hover:scale-110" />
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                <Database size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Contact Form Backend</h3>
              <p className="text-muted-foreground mb-6">
                Add a contact form to any static site. Saves submissions to Supabase and emails you alerts.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">Supabase</span>
                <span className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">Resend</span>
              </div>
              <Link href="/auth/sign-up" className="text-sm font-medium text-primary flex items-center group-hover:underline">
                Use this recipe <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* UX Principles Section */}
      <section className="w-full max-w-7xl mx-auto px-5 py-24 flex flex-col lg:flex-row gap-16 items-center">
        <div className="flex-1 space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm font-medium">
            <Shield size={14} />
            No Jargon Guarantee
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Built for people, <br/>not just developers.</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            We remove the complexity of server management, hidden configurations, and complex setup. If you know what you want to achieve, INGR handles the how.
          </p>
          <ul className="space-y-4">
            {['One-click account connections', 'No technical passwords or server settings to configure', 'Get real value within 5 minutes'].map((feature, i) => (
              <li key={i} className="flex items-center gap-3 font-medium">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <CheckCircle2 size={14} />
                </div>
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-1 relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent blur-3xl rounded-full" />
          <div className="relative rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-8 shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/30" />
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                  <Cloud className="text-muted-foreground" size={24} />
                </div>
                <div>
                  <h4 className="font-semibold">Connect Cloudflare</h4>
                  <p className="text-sm text-muted-foreground">Provides web hosting and fast networking</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-background border border-border">
                <Zap className="text-primary" size={20} />
                <div className="flex-1">
                  <h5 className="font-medium text-sm">Status: Connected</h5>
                  <p className="text-xs text-muted-foreground">Ready to use in recipes</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              </div>
              <button className="w-full py-2.5 rounded-md bg-muted text-muted-foreground text-sm font-medium border border-border opacity-50 cursor-not-allowed">
                Disconnect service
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="w-full bg-muted/30 py-24 border-y border-border/50">
        <div className="w-full max-w-5xl mx-auto px-5 flex flex-col items-center gap-12">
          <div className="text-center max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Simple, transparent pricing</h2>
            <p className="text-muted-foreground text-lg">
              Start for free, upgrade when you need more power. Less than a Netflix subscription.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
            {/* Free Tier */}
            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm flex flex-col">
              <h3 className="text-xl font-bold mb-2">Free</h3>
              <p className="text-muted-foreground mb-6">Perfect for trying things out.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <Link 
                href="/auth/sign-up" 
                className="w-full h-10 inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground mb-8"
              >
                Get Started
              </Link>
              <div className="space-y-4 mt-auto">
                {['2 active recipes', '3 connected services', 'Community support', 'INGR branding on outputs'].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="text-primary" size={16} />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pro Tier */}
            <div className="rounded-2xl border-2 border-primary bg-card p-8 shadow-md relative flex flex-col">
              <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-full shadow-sm">
                Most Popular
              </div>
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <p className="text-muted-foreground mb-6">For serious builders and businesses.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">$7</span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              <Link 
                href="/auth/sign-up" 
                className="w-full h-10 inline-flex items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm mb-8"
              >
                Upgrade to Pro
              </Link>
              <div className="space-y-4 mt-auto">
                {['Unlimited recipes', 'Unlimited connected services', 'Priority support', 'No INGR branding', 'Advanced recipe access'].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="text-primary" size={16} />
                    <span className="font-medium">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full max-w-5xl mx-auto px-5 py-32 text-center">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Stop paying for basic online services.</h2>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          Join INGR today and start building with the best free tiers on the internet.
        </p>
        <Link 
          href="/auth/sign-up" 
          className="inline-flex h-14 items-center justify-center rounded-full bg-primary px-10 text-base font-medium text-primary-foreground transition-transform hover:scale-105 active:scale-95 shadow-xl shadow-primary/20"
        >
          Create your free account
          <ArrowRight className="ml-2 h-5 w-5" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-border/50 py-12 bg-muted/20">
        <div className="max-w-7xl mx-auto px-5 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex gap-2 items-center font-bold text-lg">
            <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center text-primary">
              <Layers size={14} />
            </div>
            INGR
          </div>
          <div className="text-sm text-muted-foreground flex gap-6">
            <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
          </div>
        </div>
      </footer>
    </main>
  );
}
