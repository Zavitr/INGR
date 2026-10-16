"use client";

import React, { useState } from "react";
import { Sparkles, CornerDownLeft, Zap, CheckCircle2 } from "lucide-react";
import { generateFlowFromPrompt, GeneratedFlowRecipe } from "@/lib/recipes/flow-prompt-engine";

interface MagicPromptBarProps {
  onFlowGenerated: (flow: GeneratedFlowRecipe) => void;
  className?: string;
}

const PRESET_PROMPTS = [
  "Clash of Clans → Discord → Google Sheets",
  "When a GitHub PR is merged, deploy on Cloudflare and notify Slack",
  "When a Stripe payment succeeds, create row in Notion and email receipt",
  "When Uptime Kuma detects downtime, ping Discord alert",
  "Google Drive upload → Blender 3D render → Telegram notification",
];

export function MagicPromptBar({ onFlowGenerated, className = "" }: MagicPromptBarProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleGenerate = (textToUse?: string) => {
    const text = (textToUse || prompt).trim();
    if (!text) return;

    setIsGenerating(true);
    setSuccessNotice(null);

    // Simulate instant deterministic parse (<5ms)
    setTimeout(() => {
      try {
        const flow = generateFlowFromPrompt(text);
        onFlowGenerated(flow);
        setSuccessNotice(`Built: ${flow.title}`);
        setTimeout(() => setSuccessNotice(null), 3500);
      } catch (err) {
        console.error("Failed to generate flow:", err);
      } finally {
        setIsGenerating(false);
      }
    }, 40);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className={`w-full max-w-4xl mx-auto transition-all duration-300 ${className}`}>
      <div className="rounded-2xl border border-primary/20 bg-background/90 backdrop-blur-2xl p-2.5 shadow-xl shadow-primary/5">
        {/* Input Bar */}
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-primary-foreground shrink-0 shadow-sm">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>

          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your workflow in plain English (e.g. When Clash of Clans war ends, post to Discord and Sheets)..."
            className="flex-1 bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none px-2 py-1"
          />

          <button
            onClick={() => handleGenerate()}
            disabled={!prompt.trim() || isGenerating}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md transition-all disabled:opacity-40 shrink-0"
          >
            <span>Auto-Build</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-1.5 overflow-x-auto text-[11px] px-1 scrollbar-none">
          <span className="text-muted-foreground shrink-0 font-medium mr-1 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" />
            Quick Presets:
          </span>
          {PRESET_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setPrompt(p);
                handleGenerate(p);
              }}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Success Banner */}
        {successNotice && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium px-2 py-1 bg-emerald-500/10 rounded-lg animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{successNotice}</span>
          </div>
        )}
      </div>
    </div>
  );
}
