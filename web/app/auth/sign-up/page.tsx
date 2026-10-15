import { SignUpForm } from "@/components/sign-up-form";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center p-6 md:p-10 gap-6">
      <div className="w-full max-w-sm rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center shadow-lg backdrop-blur">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-3">
          <Sparkles size={13} />
          Open Source Edition
        </div>
        <h2 className="text-lg font-bold text-foreground mb-1">No Sign-Up Required</h2>
        <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
          INGR is open-source and free. All features, recipes, and connectors are immediately accessible.
        </p>
        <Button asChild size="lg" className="w-full bg-primary font-semibold shadow-md hover:bg-primary/90">
          <Link href="/protected" className="flex items-center justify-center gap-2">
            Enter Console Directly
            <ArrowRight size={15} />
          </Link>
        </Button>
      </div>

      <div className="w-full max-w-sm">
        <details className="text-xs text-muted-foreground cursor-pointer">
          <summary className="hover:text-foreground font-medium text-center">
            Or create a custom account (Optional)
          </summary>
          <div className="mt-4">
            <SignUpForm />
          </div>
        </details>
      </div>
    </div>
  );
}
