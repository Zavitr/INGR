"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  Database,
  CheckCircle2,
  ArrowRight,
  KeyRound,
  Pencil,
} from "lucide-react";
import { getConnectorByName, STANDARD_OUTPUT_FIELDS } from "@/lib/recipes/universal-connectors";
import type { FlowNode, OutputDataField, SimulationStepResult } from "@/lib/recipes/flow-types";

interface FlowNodeCardProps {
  node: FlowNode;
  stepIndex: number;
  upstreamNodes: FlowNode[];
  simulationResult?: SimulationStepResult;
  isSelected?: boolean;
  onSelect?: () => void;
  onUpdate: (updated: Partial<FlowNode>) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onStartConnection?: (outputKey: string) => void;
  onEndConnection?: () => void;
  isConnecting?: boolean;
}

export function FlowNodeCard({
  node,
  stepIndex,
  upstreamNodes,
  simulationResult,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onStartConnection,
  onEndConnection,
  isConnecting,
}: FlowNodeCardProps) {
  const [showOutputs, setShowOutputs] = useState(false);
  const [activeParamDropdown, setActiveParamDropdown] = useState<string | null>(null);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(node.label || node.connectorDisplayName);

  const connector = getConnectorByName(node.connectorName);
  const operations = node.type === "trigger" ? connector?.triggers || [] : connector?.actions || [];
  const currentOp = operations.find((op) => op.id === node.selectedOperationId) || operations[0];

  // Parameters defined by the operation
  const paramDefs = currentOp?.parameters || [];

  // Upstream output keys available for interpolation
  const availableUpstreamOutputs: { nodeId: string; nodeLabel: string; fields: OutputDataField[] }[] =
    upstreamNodes.map((up) => {
      const upConnector = getConnectorByName(up.connectorName);
      const fields = upConnector?.standardOutputKeys || STANDARD_OUTPUT_FIELDS;
      return {
        nodeId: up.id,
        nodeLabel: up.label,
        fields,
      };
    });

  const handleInsertPill = (paramKey: string, pillExpression: string) => {
    const currentVal = node.parameters[paramKey] || "";
    const newVal = currentVal ? `${currentVal} ${pillExpression}` : pillExpression;
    onUpdate({
      parameters: {
        ...node.parameters,
        [paramKey]: newVal,
      },
    });
    setActiveParamDropdown(null);
  };

  const isTrigger = node.type === "trigger";

  return (
    <div
      onClick={onSelect}
      className={`relative rounded-2xl border transition-all duration-200 select-none ${
        isSelected
          ? "border-primary/80 ring-2 ring-primary/30 shadow-2xl bg-card/95 dark:bg-zinc-900/95"
          : "border-border/70 hover:border-border hover:shadow-xl bg-card/85 dark:bg-zinc-900/85"
      } backdrop-blur-xl w-[360px] max-w-[calc(100vw-3rem)] text-card-foreground p-4 flex flex-col gap-3 group`}
    >
      {/* Input Port (Left handle for Actions) - aligned at top-[68px] (center 80px) */}
      {!isTrigger && (
        <div
          onMouseUp={(e) => {
            e.stopPropagation();
            if (isConnecting && onEndConnection) {
              onEndConnection();
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (isConnecting && onEndConnection) {
              onEndConnection();
            }
          }}
          title={isConnecting ? "Click or release drag to connect wire here" : "Input from previous step"}
          className={`absolute -left-3 top-[68px] w-6 h-6 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-125 cursor-pointer z-10 ${
            isConnecting
              ? "bg-primary border-primary animate-pulse ring-4 ring-primary/40"
              : "bg-background border-border hover:border-primary"
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-primary/70" />
        </div>
      )}

      {/* Output Port (Right handle for Triggers and Actions) - aligned at top-[68px] (center 80px) */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          if (onStartConnection) {
            onStartConnection("data");
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (onStartConnection) {
            onStartConnection("data");
          }
        }}
        title="Drag or click to connect to next step"
        className="absolute -right-3 top-[68px] w-6 h-6 rounded-full bg-background border-2 border-border hover:border-primary flex items-center justify-center transition-transform hover:scale-125 cursor-pointer z-10 hover:ring-4 hover:ring-primary/20 shadow-md"
      >
        <ArrowRight className="w-3 h-3 text-primary" />
      </div>

      {/* Card Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Logo */}
          <div className="w-8 h-8 rounded-xl bg-muted/60 border border-border/50 flex items-center justify-center overflow-hidden shrink-0 shadow-sm p-1">
            {node.connectorLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={node.connectorLogoUrl}
                alt={node.connectorDisplayName}
                className="w-full h-full object-contain rounded"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Sparkles className="w-4 h-4 text-primary" />
            )}
          </div>

          {/* Titles */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[9px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded ${
                  isTrigger
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                }`}
              >
                Step {stepIndex + 1} · {isTrigger ? "Trigger" : "Action"}
              </span>
            </div>

            {isEditingLabel ? (
              <input
                type="text"
                autoFocus
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={() => {
                  const finalLabel = labelDraft.trim() || node.connectorDisplayName;
                  onUpdate({ label: finalLabel });
                  setIsEditingLabel(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const finalLabel = labelDraft.trim() || node.connectorDisplayName;
                    onUpdate({ label: finalLabel });
                    setIsEditingLabel(false);
                  } else if (e.key === "Escape") {
                    setLabelDraft(node.label || node.connectorDisplayName);
                    setIsEditingLabel(false);
                  }
                }}
                className="font-semibold text-xs bg-muted/60 border border-primary/50 rounded px-1.5 py-0.5 outline-none text-foreground mt-0.5"
              />
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setLabelDraft(node.label || node.connectorDisplayName);
                  setIsEditingLabel(true);
                }}
                className="flex items-center gap-1 cursor-pointer group/title mt-0.5"
                title="Click to rename step"
              >
                <span className="font-semibold text-sm truncate text-foreground leading-tight">
                  {node.label || node.connectorDisplayName}
                </span>
                <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
              </div>
            )}
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          {simulationResult && (
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                simulationResult.status === "success"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : simulationResult.status === "warning"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  : "bg-red-500/10 text-red-600 border-red-500/20"
              }`}
              title={`Simulated execution time: ${simulationResult.durationMs}ms (${simulationResult.status})`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>{simulationResult.durationMs}ms</span>
            </div>
          )}
          {onDuplicate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors"
              title="Duplicate step"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors"
            title="Delete step"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Operation Picker */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
          <span>{isTrigger ? "Trigger Event" : "Action Operation"}</span>
        </label>
        {operations.length > 0 ? (
          <select
            value={node.selectedOperationId || currentOp?.id || ""}
            onChange={(e) => {
              const newOpId = e.target.value;
              const newOp = operations.find((op) => op.id === newOpId);
              const defaultParams: Record<string, string | number | boolean | Record<string, unknown>> = {};
              if (newOp?.parameters) {
                for (const p of newOp.parameters) {
                  if (p.defaultValue !== undefined) {
                    defaultParams[p.key] = p.defaultValue;
                  }
                }
              }
              onUpdate({
                selectedOperationId: newOpId,
                label: `${node.connectorDisplayName}: ${newOp?.name || newOpId}`,
                parameters: { ...defaultParams, ...node.parameters },
              });
            }}
            className="w-full text-xs bg-background/90 border border-border/80 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary text-foreground transition-all cursor-pointer font-medium"
          >
            {operations.map((op) => (
              <option key={op.id} value={op.id}>
                {op.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-xs text-muted-foreground italic px-2 py-1 bg-muted/40 rounded border border-border/30">
            Universal Automated Handler
          </div>
        )}
        {currentOp?.description && (
          <p className="text-[11px] text-muted-foreground/80 line-clamp-2 px-0.5 mt-0.5">
            {currentOp.description}
          </p>
        )}
      </div>

      {/* Parameter Inputs */}
      {paramDefs.length > 0 && (
        <div className="space-y-2.5 pt-1 border-t border-border/30">
          {paramDefs.map((param) => {
            const rawVal = node.parameters[param.key] ?? param.defaultValue ?? "";
            const val = typeof rawVal === "object" ? JSON.stringify(rawVal) : String(rawVal);
            const isDropdownOpen = activeParamDropdown === param.key;

            return (
              <div key={param.key} className="space-y-1 relative">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {param.label}
                    {param.required && <span className="text-destructive ml-0.5">*</span>}
                  </span>

                  {/* Insert Data Pill Button */}
                  {availableUpstreamOutputs.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveParamDropdown(isDropdownOpen ? null : param.key);
                      }}
                      className="text-[10px] text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1 bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-full transition-all"
                    >
                      <Database className="w-2.5 h-2.5" />
                      <span>+ Insert Upstream Data</span>
                    </button>
                  )}
                </div>

                {/* Data Pill Dropdown Menu */}
                {isDropdownOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute z-30 left-0 right-0 top-full mt-1 bg-popover/95 border border-border rounded-xl shadow-2xl p-2 max-h-52 overflow-y-auto backdrop-blur-xl animate-in fade-in zoom-in-95 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-border/40 text-[11px] text-muted-foreground font-medium">
                      <span>Click output to insert variable pill:</span>
                      <button
                        onClick={() => setActiveParamDropdown(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    </div>

                    {availableUpstreamOutputs.map((up) => (
                      <div key={up.nodeId} className="space-y-1">
                        <div className="text-[10px] font-mono uppercase text-muted-foreground/70 font-semibold">
                          From: {up.nodeLabel}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {up.fields.map((f) => (
                            <button
                              key={f.key}
                              type="button"
                              onClick={() => handleInsertPill(param.key, `{{${up.nodeId}.${f.key}}}`)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted hover:bg-primary/20 hover:text-primary border border-border/60 text-[11px] font-mono transition-colors text-foreground"
                              title={f.description}
                            >
                              <span className="text-primary font-bold">{f.key}</span>
                              <span className="text-[9px] text-muted-foreground">({f.type})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input Control */}
                {param.type === "select" && param.options ? (
                  <select
                    value={val}
                    onChange={(e) =>
                      onUpdate({
                        parameters: { ...node.parameters, [param.key]: e.target.value },
                      })
                    }
                    className="w-full text-xs bg-background/90 border border-border/80 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary text-foreground"
                  >
                    {param.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : param.type === "textarea" ? (
                  <textarea
                    rows={2}
                    value={val}
                    onChange={(e) =>
                      onUpdate({
                        parameters: { ...node.parameters, [param.key]: e.target.value },
                      })
                    }
                    placeholder={param.placeholder || "Enter parameter value..."}
                    className="w-full text-xs bg-background/90 border border-border/80 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground/50 resize-none font-mono"
                  />
                ) : (
                  <input
                    type="text"
                    value={val}
                    onChange={(e) =>
                      onUpdate({
                        parameters: { ...node.parameters, [param.key]: e.target.value },
                      })
                    }
                    placeholder={param.placeholder || "Enter value..."}
                    className="w-full text-xs bg-background/90 border border-border/80 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground/50 font-mono"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Output Schema Accordion */}
      <div className="pt-1 border-t border-border/30">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowOutputs(!showOutputs);
          }}
          className="w-full flex items-center justify-between text-[11px] text-muted-foreground hover:text-foreground py-0.5 font-medium transition-colors"
        >
          <span className="flex items-center gap-1">
            <KeyRound className="w-3 h-3 text-primary/70" />
            <span>Exposed Step Outputs ({connector?.standardOutputKeys.length || 8})</span>
          </span>
          {showOutputs ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        {showOutputs && (
          <div className="mt-1.5 space-y-1 p-2 rounded-lg bg-muted/40 border border-border/40 text-[10px] font-mono max-h-36 overflow-y-auto">
            {(connector?.standardOutputKeys || STANDARD_OUTPUT_FIELDS).map((f) => (
              <div key={f.key} className="flex items-center justify-between py-0.5 border-b border-border/20 last:border-none">
                <span className="text-primary font-semibold">{f.key}</span>
                <span className="text-muted-foreground">[{f.type}]</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
