"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  LayoutGrid,
  ListOrdered,
  Play,
  Save,
  Sparkles,
  Check,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { FlowCanvas } from "./flow-canvas";
import { FlowLinear } from "./flow-linear";
import { ConnectorSpotlight } from "./connector-spotlight";
import { SimulationInspector } from "./simulation-inspector";
import { getTotalConnectorCount } from "@/lib/recipes/universal-connectors";
import type {
  FlowNode,
  FlowConnection,
  FlowViewMode,
  SimulationResult,
  UniversalConnector,
} from "@/lib/recipes/flow-types";

interface FlowStudioProps {
  initialRecipeId?: string;
  initialName?: string;
}

// Starter cross-connector flow: Discord Event -> Blender 3D Render -> Slack Notification
const DEFAULT_INITIAL_NODES: FlowNode[] = [
  {
    id: "step_1_trigger",
    type: "trigger",
    connectorName: "@activepieces/piece-discord",
    connectorDisplayName: "Discord",
    connectorLogoUrl: "https://cdn.activepieces.com/pieces/discord.png",
    category: "Communication",
    selectedOperationId: "message_received",
    label: "Discord Message Received",
    position: { x: 60, y: 160 },
    parameters: {
      channelId: "general",
      keywordFilter: "!render",
    },
  },
  {
    id: "step_2_render",
    type: "action",
    connectorName: "custom-blender-render",
    connectorDisplayName: "Blender 3D Render",
    connectorLogoUrl: "https://www.blender.org/wp-content/themes/bthree/assets/images/blender-logo-icon.png",
    category: "Creative & 3D Design",
    selectedOperationId: "trigger_render_job",
    label: "Blender 3D Headless Render",
    position: { x: 480, y: 160 },
    parameters: {
      sceneAssetUrl: "https://pages.dev/models/game_trophy.blend",
      renderPreset: "eevee_fast",
      outputDestination: "cloudflare-r2-exports",
    },
  },
  {
    id: "step_3_notify",
    type: "action",
    connectorName: "@activepieces/piece-slack",
    connectorDisplayName: "Slack",
    connectorLogoUrl: "https://cdn.activepieces.com/pieces/slack.png",
    category: "Communication",
    selectedOperationId: "send_message",
    label: "Post to Slack Team",
    position: { x: 900, y: 160 },
    parameters: {
      channelOrRecipient: "#announcements",
      messageContent: "🎉 3D Asset Render Finished from {{step_1_trigger.author}}! View at: {{step_2_render.renderUrl}}",
      attachedMediaUrl: "{{step_2_render.renderUrl}}",
    },
  },
];

const DEFAULT_INITIAL_CONNECTIONS: FlowConnection[] = [
  {
    id: "conn_1_to_2",
    sourceNodeId: "step_1_trigger",
    targetNodeId: "step_2_render",
    sourceOutputKey: "data",
  },
  {
    id: "conn_2_to_3",
    sourceNodeId: "step_2_render",
    targetNodeId: "step_3_notify",
    sourceOutputKey: "renderUrl",
  },
];

export function FlowStudio({ initialRecipeId, initialName }: FlowStudioProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const effectiveInitialId = initialRecipeId || searchParams.get("id") || undefined;

  // Recipe State
  const [recipeId, setRecipeId] = useState<string | undefined>(effectiveInitialId);
  const [recipeName, setRecipeName] = useState(
    initialName || "Universal Cross-Service Automation"
  );
  const [nodes, setNodes] = useState<FlowNode[]>(DEFAULT_INITIAL_NODES);
  const [connections, setConnections] = useState<FlowConnection[]>(DEFAULT_INITIAL_CONNECTIONS);
  const [viewMode, setViewMode] = useState<FlowViewMode>("canvas");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Load existing recipe on mount if ID provided
  useEffect(() => {
    if (!effectiveInitialId) return;
    let isMounted = true;
    async function fetchRecipe() {
      try {
        const res = await fetch(`/api/recipes/flow?id=${effectiveInitialId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted || !data.recipe) return;
        const flow = data.recipe.metadata?.flow;
        if (flow?.nodes && Array.isArray(flow.nodes) && flow.nodes.length > 0) {
          setNodes(flow.nodes);
        }
        if (flow?.connections && Array.isArray(flow.connections)) {
          setConnections(flow.connections);
        }
        if (flow?.viewMode) {
          setViewMode(flow.viewMode);
        }
        if (data.recipe.name) {
          setRecipeName(data.recipe.name);
        }
        setRecipeId(data.recipe.id);
      } catch (e) {
        console.error("Failed to load recipe:", e);
      }
    }
    fetchRecipe();
    return () => {
      isMounted = false;
    };
  }, [effectiveInitialId]);

  // UI state
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [spotlightTargetType, setSpotlightTargetType] = useState<"trigger" | "action">("action");
  const [spotlightInsertIndex, setSpotlightInsertIndex] = useState<number | undefined>(undefined);

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const totalConnectorCount = getTotalConnectorCount();

  // Handle Simulation Run
  const handleSimulate = useCallback(async () => {
    setIsSimulating(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/recipes/flow/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes,
          connections,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Simulation failed.");
      }

      const result: SimulationResult = await res.json();
      setSimulationResult(result);
      setIsInspectorOpen(true);
    } catch (err) {
      console.error("Simulation run error:", err);
      setSaveError(err instanceof Error ? err.message : "Simulation failed.");
    } finally {
      setIsSimulating(false);
    }
  }, [nodes, connections]);

  // Handle Save Recipe
  const handleSaveRecipe = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/recipes/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: recipeId,
          name: recipeName,
          nodes,
          connections,
          viewMode,
          status: "active",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save recipe flow.");
      }

      if (data.recipe?.id) {
        setRecipeId(data.recipe.id);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      router.refresh();
    } catch (err) {
      console.error("Save recipe error:", err);
      setSaveError(err instanceof Error ? err.message : "Failed to save recipe.");
    } finally {
      setIsSaving(false);
    }
  }, [recipeId, recipeName, nodes, connections, viewMode, router]);

  // Keyboard Shortcuts: ⌘K (Spotlight), ⌘R / Ctrl+Enter (Simulate), ⌘S (Save)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSpotlightTargetType("action");
        setSpotlightInsertIndex(undefined);
        setIsSpotlightOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "Enter" || e.key === "r")) {
        e.preventDefault();
        handleSimulate();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSaveRecipe();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSimulate, handleSaveRecipe]);

  // Spotlight Connector Picked
  const handleSelectConnector = (connector: UniversalConnector) => {
    const isFirstNode = nodes.length === 0 || spotlightTargetType === "trigger";
    const type = isFirstNode ? "trigger" : "action";
    const operation = type === "trigger" ? connector.triggers[0] : connector.actions[0];

    const newNodeId = `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const lastNode = nodes[nodes.length - 1];

    const newNode: FlowNode = {
      id: newNodeId,
      type,
      connectorName: connector.name,
      connectorDisplayName: connector.displayName,
      connectorLogoUrl: connector.logoUrl,
      category: connector.category,
      selectedOperationId: operation?.id || "default",
      label: `${connector.displayName} ${type === "trigger" ? "Trigger" : "Action"}`,
      position: lastNode
        ? { x: lastNode.position.x + 400, y: lastNode.position.y }
        : { x: 80, y: 160 },
      parameters: {},
    };

    if (spotlightInsertIndex !== undefined) {
      const nextNodes = [...nodes];
      nextNodes.splice(spotlightInsertIndex, 0, newNode);
      setNodes(nextNodes);

      // Auto-connect if appropriate
      if (spotlightInsertIndex > 0) {
        const prevNode = nextNodes[spotlightInsertIndex - 1];
        setConnections((prev) => [
          ...prev,
          {
            id: `conn_${Date.now()}`,
            sourceNodeId: prevNode.id,
            targetNodeId: newNode.id,
            sourceOutputKey: "data",
          },
        ]);
      }
    } else {
      setNodes((prev) => [...prev, newNode]);

      // Connect to previous node if exists
      if (lastNode && !isFirstNode) {
        setConnections((prev) => [
          ...prev,
          {
            id: `conn_${Date.now()}`,
            sourceNodeId: lastNode.id,
            targetNodeId: newNode.id,
            sourceOutputKey: "data",
          },
        ]);
      }
    }

    setSelectedNodeId(newNodeId);
  };

  // Node Mutations
  const handleUpdateNode = (nodeId: string, updated: Partial<FlowNode>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, ...updated } : n))
    );
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setConnections((prev) =>
      prev.filter((c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId)
    );
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  const handleDuplicateNode = (nodeId: string) => {
    const original = nodes.find((n) => n.id === nodeId);
    if (!original) return;

    const dupId = `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const duplicate: FlowNode = {
      ...original,
      id: dupId,
      label: `${original.label} (Copy)`,
      position: { x: original.position.x + 40, y: original.position.y + 40 },
    };

    setNodes((prev) => [...prev, duplicate]);
  };

  const handleReorderNodes = (sourceIdx: number, targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= nodes.length) return;
    const reordered = [...nodes];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setNodes(reordered);
  };

  // Connection Mutations
  const handleAddConnection = (conn: FlowConnection) => {
    setConnections((prev) => [...prev, conn]);
  };

  const handleDeleteConnection = (connId: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== connId));
  };

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden bg-background">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-border/80 px-4 md:px-6 flex items-center justify-between gap-4 bg-card/80 backdrop-blur-xl shrink-0 z-30">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/protected/recipes"
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors shrink-0"
            title="Back to Recipes"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="h-4 w-px bg-border/60 shrink-0" />

          {/* Inline Editable Recipe Title */}
          <input
            type="text"
            value={recipeName}
            onChange={(e) => setRecipeName(e.target.value)}
            className="font-bold text-sm md:text-base bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none px-1 py-0.5 text-foreground max-w-[200px] md:max-w-md transition-colors"
            placeholder="Untitled Recipe Flow"
          />

          <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active Flow
          </span>

          {simulationResult?.hasCycle && (
            <span
              onClick={() => setIsInspectorOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition-colors"
              title="Circular connection detected and resolved safely. Click to inspect."
            >
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span>Cycle Resolved</span>
            </span>
          )}
        </div>

        {/* Center: View Switcher (Canvas vs. Linear) */}
        <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/60 shrink-0">
          <button
            onClick={() => setViewMode("canvas")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "canvas"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Canvas Mode</span>
          </button>
          <button
            onClick={() => setViewMode("linear")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "linear"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Linear Mode</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Spotlight Palette Launcher */}
          <button
            onClick={() => {
              setSpotlightTargetType("action");
              setSpotlightInsertIndex(undefined);
              setIsSpotlightOpen(true);
            }}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-xs font-medium text-foreground border border-border/60 transition-all hover:border-primary/50"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>{totalConnectorCount.toLocaleString()}+ Connectors</span>
            <kbd className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-border/60 font-mono text-muted-foreground ml-1">
              ⌘K
            </kbd>
          </button>

          {/* Simulate DAG Button */}
          <button
            onClick={handleSimulate}
            disabled={isSimulating || nodes.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            title="Simulate DAG data execution (⌘R)"
          >
            {isSimulating ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isSimulating ? "Simulating..." : "Simulate Run"}</span>
          </button>

          {/* Save Recipe Button */}
          <button
            onClick={handleSaveRecipe}
            disabled={isSaving || nodes.length === 0}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold shadow-md transition-all ${
              saveSuccess
                ? "bg-emerald-600 text-white"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            } disabled:opacity-50`}
          >
            {isSaving ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{saveSuccess ? "Saved!" : "Save Flow"}</span>
          </button>
        </div>
      </header>

      {/* Save Error Notice */}
      {saveError && (
        <div className="bg-destructive/10 border-b border-destructive/20 text-destructive text-xs px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{saveError}</span>
          </div>
          <button
            onClick={() => setSaveError(null)}
            className="text-destructive font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace: Canvas or Linear */}
      <main className="flex-1 relative overflow-hidden flex">
        {viewMode === "canvas" ? (
          <FlowCanvas
            nodes={nodes}
            connections={connections}
            simulationSteps={simulationResult?.steps}
            isSimulating={isSimulating}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onDuplicateNode={handleDuplicateNode}
            onAddConnection={handleAddConnection}
            onDeleteConnection={handleDeleteConnection}
            onOpenSpotlight={(type) => {
              setSpotlightTargetType(type);
              setSpotlightInsertIndex(undefined);
              setIsSpotlightOpen(true);
            }}
          />
        ) : (
          <FlowLinear
            nodes={nodes}
            simulationSteps={simulationResult?.steps}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onDuplicateNode={handleDuplicateNode}
            onReorderNodes={handleReorderNodes}
            onOpenSpotlight={(type, insertIndex) => {
              setSpotlightTargetType(type);
              setSpotlightInsertIndex(insertIndex);
              setIsSpotlightOpen(true);
            }}
          />
        )}
      </main>

      {/* ⌘K Spotlight Connector Palette */}
      <ConnectorSpotlight
        isOpen={isSpotlightOpen}
        onClose={() => setIsSpotlightOpen(false)}
        onSelect={handleSelectConnector}
        targetType={spotlightTargetType}
      />

      {/* Simulation Inspector Slide-over Drawer */}
      <SimulationInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        result={simulationResult}
        isLoading={isSimulating}
      />
    </div>
  );
}
