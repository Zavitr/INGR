"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Plus, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { FlowNodeCard } from "./flow-node-card";
import type {
  FlowNode,
  FlowConnection,
  SimulationStepResult,
} from "@/lib/recipes/flow-types";

interface FlowCanvasProps {
  nodes: FlowNode[];
  connections: FlowConnection[];
  simulationSteps?: SimulationStepResult[];
  isSimulating?: boolean;
  selectedNodeId?: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onUpdateNode: (nodeId: string, updated: Partial<FlowNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  onAddConnection: (connection: FlowConnection) => void;
  onDeleteConnection: (connectionId: string) => void;
  onOpenSpotlight: (type: "trigger" | "action") => void;
}

const CARD_WIDTH = 360;
const PORT_Y = 80;

export function FlowCanvas({
  nodes,
  connections,
  simulationSteps,
  isSimulating,
  selectedNodeId,
  onSelectNode,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
  onAddConnection,
  onDeleteConnection,
  onOpenSpotlight,
}: FlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Node Dragging State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Connection Dragging State
  const [connectingSource, setConnectingSource] = useState<{
    nodeId: string;
    outputKey: string;
  } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Zoom handlers
  const handleZoomIn = () => setScale((s) => Math.min(s + 0.15, 1.8));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.15, 0.5));
  const handleResetView = () => {
    setScale(1);
    setPan({ x: 40, y: 40 });
  };

  // Wheel Zoom & Pan
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
      setScale((s) => Math.min(Math.max(Number((s + zoomDelta).toFixed(2)), 0.4), 2.0));
    } else {
      setPan((p) => ({
        x: Math.round(p.x - e.deltaX),
        y: Math.round(p.y - e.deltaY),
      }));
    }
  };

  // Canvas Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (connectingSource) {
      setConnectingSource(null);
    }
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === "svg") {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      onSelectNode(null);
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - startPan.x,
          y: e.clientY - startPan.y,
        });
      } else if (draggingNodeId) {
        const newX = Math.round((e.clientX - pan.x - dragOffset.x) / scale);
        const newY = Math.round((e.clientY - pan.y - dragOffset.y) / scale);
        onUpdateNode(draggingNodeId, {
          position: { x: Math.max(0, newX), y: Math.max(0, newY) },
        });
      } else if (connectingSource) {
        setMousePos({
          x: (e.clientX - pan.x) / scale,
          y: (e.clientY - pan.y) / scale,
        });
      }
    },
    [isPanning, startPan, draggingNodeId, dragOffset, pan, scale, connectingSource, onUpdateNode]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingNodeId(null);
    // Note: Do not clear connectingSource here so click-to-connect works cleanly
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Cancel connecting wire on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && connectingSource) {
        setConnectingSource(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [connectingSource]);

  // Start dragging node
  const startDragNode = (nodeId: string, e: React.MouseEvent) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setDraggingNodeId(nodeId);
    setDragOffset({
      x: e.clientX - pan.x - node.position.x * scale,
      y: e.clientY - pan.y - node.position.y * scale,
    });
    onSelectNode(nodeId);
  };

  // Start creating connection
  const handleStartConnection = (sourceNodeId: string, outputKey = "data") => {
    setConnectingSource({ nodeId: sourceNodeId, outputKey });
    const sourceNode = nodes.find((n) => n.id === sourceNodeId);
    if (sourceNode) {
      setMousePos({
        x: sourceNode.position.x + CARD_WIDTH,
        y: sourceNode.position.y + PORT_Y,
      });
    }
  };

  // Complete connection
  const handleEndConnection = (targetNodeId: string) => {
    if (!connectingSource || connectingSource.nodeId === targetNodeId) {
      setConnectingSource(null);
      return;
    }

    // Check if connection already exists
    const exists = connections.some(
      (c) =>
        c.sourceNodeId === connectingSource.nodeId &&
        c.targetNodeId === targetNodeId
    );

    if (!exists) {
      onAddConnection({
        id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sourceNodeId: connectingSource.nodeId,
        targetNodeId,
        sourceOutputKey: connectingSource.outputKey,
      });
    }

    setConnectingSource(null);
  };

  // Compute Bézier curve path string
  const computeBezierPath = (
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) => {
    const dx = Math.max(Math.abs(x2 - x1) * 0.5, 40);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      className="relative w-full h-full min-h-[640px] flex-1 overflow-hidden select-none bg-[radial-gradient(#d1d5db_1px,transparent_1px)] [background-size:24px_24px] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] bg-slate-50 dark:bg-zinc-950 cursor-grab active:cursor-grabbing"
    >
      {/* Zoom / Canvas Controls Float */}
      <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1.5 bg-card/90 dark:bg-zinc-900/90 border border-border/80 shadow-lg rounded-2xl p-1.5 backdrop-blur-xl">
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-[11px] font-mono px-2 text-muted-foreground font-semibold">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={handleResetView}
          className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all"
          title="Reset Zoom & Pan"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Add Step Button */}
      <div className="absolute top-5 right-5 z-20 flex items-center gap-2">
        <button
          onClick={() => onOpenSpotlight("action")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary text-primary-foreground font-semibold text-xs shadow-xl hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Connector Step</span>
        </button>
      </div>

      {/* SVG Canvas for Bézier Connection Curves */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        <defs>
          <linearGradient id="flowWireGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#8b5cf6" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Existing Connections */}
        {connections.map((conn) => {
          const sourceNode = nodes.find((n) => n.id === conn.sourceNodeId);
          const targetNode = nodes.find((n) => n.id === conn.targetNodeId);
          if (!sourceNode || !targetNode) return null;

          const x1 = sourceNode.position.x + CARD_WIDTH;
          const y1 = sourceNode.position.y + PORT_Y;
          const x2 = targetNode.position.x;
          const y2 = targetNode.position.y + PORT_Y;

          const pathD = computeBezierPath(x1, y1, x2, y2);
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;

          return (
            <g key={conn.id} className="group pointer-events-auto cursor-pointer">
              {/* Wide invisible hit area for easy hover and click detection */}
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth={24}
              />

              {/* Outer Wire Glow */}
              <path
                d={pathD}
                fill="none"
                stroke="url(#flowWireGradient)"
                strokeWidth={4}
                filter="url(#glow)"
                className="opacity-70 group-hover:opacity-100 transition-opacity"
              />

              {/* Main Core Wire */}
              <path
                d={pathD}
                fill="none"
                stroke="#8b5cf6"
                strokeWidth={2}
                strokeDasharray={isSimulating ? "6 6" : "none"}
                className={isSimulating ? "animate-pulse" : ""}
              />

              {/* Glowing Simulation Flow Particles */}
              {isSimulating && (
                <>
                  <circle r={5} fill="#10b981">
                    <animateMotion dur="1.2s" repeatCount="indefinite" path={pathD} />
                  </circle>
                  <circle r={4} fill="#38bdf8">
                    <animateMotion dur="1.2s" begin="0.6s" repeatCount="indefinite" path={pathD} />
                  </circle>
                </>
              )}

              {/* Wire Delete Button at Center */}
              <g
                transform={`translate(${midX}, ${midY})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConnection(conn.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:scale-125"
              >
                <circle r={10} fill="#ef4444" className="shadow-md" />
                <path d="M -3 -3 L 3 3 M 3 -3 L -3 3" stroke="#ffffff" strokeWidth={1.5} />
              </g>
            </g>
          );
        })}

        {/* Live Connecting Wire while dragging */}
        {connectingSource && (
          <path
            d={(() => {
              const src = nodes.find((n) => n.id === connectingSource.nodeId);
              if (!src) return "";
              const x1 = src.position.x + CARD_WIDTH;
              const y1 = src.position.y + PORT_Y;
              return computeBezierPath(x1, y1, mousePos.x, mousePos.y);
            })()}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={3}
            strokeDasharray="4 4"
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Render Node Cards in Canvas Coordinates */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {nodes.map((node, index) => {
          const upstreamNodes = nodes.filter((n) => {
            const hasConnection = connections.some(
              (c) => c.sourceNodeId === n.id && c.targetNodeId === node.id
            );
            return hasConnection || (nodes.indexOf(n) < index && n.id !== node.id);
          });

          const stepResult = simulationSteps?.find((s) => s.nodeId === node.id);

          return (
            <div
              key={node.id}
              style={{
                position: "absolute",
                left: `${node.position.x}px`,
                top: `${node.position.y}px`,
              }}
              onMouseDown={(e) => {
                // If user clicks header or card background, initiate drag
                if (
                  (e.target as HTMLElement).closest("input") ||
                  (e.target as HTMLElement).closest("select") ||
                  (e.target as HTMLElement).closest("textarea") ||
                  (e.target as HTMLElement).closest("button")
                ) {
                  return;
                }
                startDragNode(node.id, e);
              }}
              className="pointer-events-auto"
            >
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
                onStartConnection={(outputKey) => handleStartConnection(node.id, outputKey)}
                onEndConnection={() => handleEndConnection(node.id)}
                isConnecting={Boolean(connectingSource && connectingSource.nodeId !== node.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
