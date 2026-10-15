"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  Zap,
  AlertTriangle,
} from "lucide-react";
import type { SimulationResult, SimulationStepResult } from "@/lib/recipes/flow-types";

interface SimulationInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  result: SimulationResult | null;
  isLoading?: boolean;
}

export function SimulationInspector({
  isOpen,
  onClose,
  result,
  isLoading,
}: SimulationInspectorProps) {
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"outputs" | "inputs" | "logs">("outputs");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentStep: SimulationStepResult | undefined = result?.steps[selectedStepIndex];

  const handleCopyJson = (data: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-card/95 dark:bg-zinc-900/95 border-l border-border/80 shadow-2xl backdrop-blur-2xl flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground leading-tight">
              Live Simulation Trace
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>{result?.steps.length || 0} steps executed</span>
              <span>·</span>
              <span className="font-mono text-emerald-500 font-medium">
                {result?.totalDurationMs || 0}ms total
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">
            Simulating DAG data flow through connectors...
          </p>
        </div>
      ) : !result || result.steps.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
          <Zap className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">No simulation data available</p>
          <p className="text-xs">Click &quot;Simulate Run&quot; in the top bar to test your flow.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Cycle Advisory Banner */}
          {result.hasCycle && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div className="space-y-0.5">
                <span className="font-semibold">Circular Connection Detected</span>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {result.cycleWarning || "A dependency loop was safely ordered using fallback topological sequence."}
                </p>
              </div>
            </div>
          )}

          {/* Step Timeline Pills */}
          <div className="flex items-center gap-2 px-6 py-3 border-b border-border/40 overflow-x-auto no-scrollbar bg-muted/20">
            {result.steps.map((step, idx) => {
              const isSelected = selectedStepIndex === idx;
              return (
                <button
                  key={step.nodeId}
                  onClick={() => setSelectedStepIndex(idx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 border ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60"
                  }`}
                >
                  <span className="font-mono font-bold text-[10px]">#{idx + 1}</span>
                  <span className="truncate max-w-[110px]">{step.connectorDisplayName}</span>
                  <span className="text-[10px] opacity-80 font-mono">{step.durationMs}ms</span>
                </button>
              );
            })}
          </div>

          {currentStep && (
            <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
              {/* Step Summary Banner */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center p-1 overflow-hidden">
                    {currentStep.connectorLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentStep.connectorLogoUrl}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Sparkles className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {currentStep.nodeLabel}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono">
                      {currentStep.connectorName} · {currentStep.operationId}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentStep.status === "warning" ? (
                    <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Loop Ordered</span>
                    </span>
                  ) : (
                    <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>200 OK</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Tab Selector */}
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("outputs")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === "outputs"
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Outputs Schema ({Object.keys(currentStep.output || {}).length})
                  </button>
                  <button
                    onClick={() => setActiveTab("inputs")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === "inputs"
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Resolved Inputs
                  </button>
                  <button
                    onClick={() => setActiveTab("logs")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      activeTab === "logs"
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Execution Logs
                  </button>
                </div>

                {activeTab !== "logs" && (
                  <button
                    onClick={() =>
                      handleCopyJson(
                        activeTab === "outputs" ? currentStep.output : currentStep.resolvedInputs
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground bg-muted/60 px-2.5 py-1 rounded-md transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied" : "Copy JSON"}</span>
                  </button>
                )}
              </div>

              {/* Content Panel */}
              <div className="flex-1 overflow-y-auto rounded-xl bg-zinc-950 text-zinc-200 p-4 border border-zinc-800 font-mono text-xs">
                {activeTab === "outputs" ? (
                  <pre className="whitespace-pre-wrap leading-relaxed text-emerald-400">
                    {JSON.stringify(currentStep.output, null, 2)}
                  </pre>
                ) : activeTab === "inputs" ? (
                  <pre className="whitespace-pre-wrap leading-relaxed text-blue-400">
                    {JSON.stringify(currentStep.resolvedInputs, null, 2)}
                  </pre>
                ) : (
                  <div className="space-y-2">
                    {currentStep.logs.map((log, i) => (
                      <div key={i} className="text-zinc-400 flex items-start gap-2">
                        <span className="text-zinc-600 select-none">[{i + 1}]</span>
                        <span
                          className={
                            log.includes("[WARN]")
                              ? "text-amber-400 font-semibold"
                              : log.includes("[SUCCESS]")
                              ? "text-emerald-300"
                              : "text-zinc-300"
                          }
                        >
                          {log}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
