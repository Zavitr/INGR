"use client";

import React from "react";
import { Plus, MoveUp, MoveDown } from "lucide-react";
import { FlowNodeCard } from "./flow-node-card";
import type { FlowNode, SimulationStepResult } from "@/lib/recipes/flow-types";

interface FlowLinearProps {
  nodes: FlowNode[];
  simulationSteps?: SimulationStepResult[];
  selectedNodeId?: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onUpdateNode: (nodeId: string, updated: Partial<FlowNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  onReorderNodes: (sourceIndex: number, targetIndex: number) => void;
  onOpenSpotlight: (type: "trigger" | "action", insertIndex?: number) => void;
}

export function FlowLinear({
  nodes,
  simulationSteps,
  selectedNodeId,
  onSelectNode,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
  onReorderNodes,
  onOpenSpotlight,
}: FlowLinearProps) {
  return (
    <div className="w-full flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center bg-slate-50/50 dark:bg-zinc-950/50">
      <div className="w-full max-w-xl flex flex-col items-center gap-6">
        {nodes.map((node, index) => {
          const upstreamNodes = nodes.slice(0, index);
          const stepResult = simulationSteps?.find((s) => s.nodeId === node.id);

          return (
            <React.Fragment key={node.id}>
              {/* Node Wrapper with Step Controls */}
              <div className="w-full relative group">
                {/* Reordering Controls */}
                <div className="absolute -left-12 top-6 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    disabled={index === 0}
                    onClick={() => onReorderNodes(index, index - 1)}
                    className="p-1 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                    title="Move Step Up"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={index === nodes.length - 1}
                    onClick={() => onReorderNodes(index, index + 1)}
                    className="p-1 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                    title="Move Step Down"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Card Wrapper */}
                <div className="w-full flex justify-center">
                  <FlowNodeCard
                    node={node}
                    stepIndex={index}
                    upstreamNodes={upstreamNodes}
                    simulationResult={stepResult}
                    isSelected={selectedNodeId === node.id}
                    onSelect={() => onSelectNode(node.id)}
                    onUpdate={(up) => onUpdateNode(node.id, up)}
                    onDelete={() => onDeleteNode(node.id)}
                    onDuplicate={onDuplicateNode ? () => onDuplicateNode(node.id) : undefined}
                  />
                </div>
              </div>

              {/* Connecting Pipe / Divider */}
              {index < nodes.length - 1 && (
                <div className="flex flex-col items-center my-1 group/connector">
                  <div className="w-0.5 h-6 bg-gradient-to-b from-primary/60 to-primary/20" />
                  <button
                    onClick={() => onOpenSpotlight("action", index + 1)}
                    className="p-1 rounded-full bg-background border border-border shadow-sm text-muted-foreground hover:text-primary hover:border-primary hover:scale-110 transition-all"
                    title="Insert step here"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-0.5 h-6 bg-gradient-to-b from-primary/20 to-primary/60" />
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* Append Step at the Bottom */}
        <div className="w-full flex justify-center pt-2 pb-12">
          <button
            onClick={() => onOpenSpotlight("action")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-card hover:bg-muted/70 text-foreground font-semibold text-xs border border-dashed border-border/80 hover:border-primary/60 shadow-sm transition-all hover:scale-102 active:scale-98"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>Add Next Connector Step</span>
          </button>
        </div>
      </div>
    </div>
  );
}
