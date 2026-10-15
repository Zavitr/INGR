import { NextResponse } from "next/server";
import {
  getConnectorByName,
  interpolateParameters,
  generateMockOutput,
  STANDARD_OUTPUT_FIELDS,
} from "@/lib/recipes/universal-connectors";
import type {
  FlowNode,
  FlowConnection,
  SimulationStepResult,
  SimulationResult,
  UniversalConnector,
} from "@/lib/recipes/flow-types";

// Fallback connector builder when connector is unknown or custom
function createFallbackConnector(node: FlowNode): UniversalConnector {
  return {
    name: node.connectorName || "custom-universal-connector",
    displayName: node.connectorDisplayName || node.label || "Custom Service",
    description: "Universal custom integration connector",
    logoUrl: node.connectorLogoUrl || "https://cdn.activepieces.com/pieces/generic.png",
    version: "1.0.0",
    category: node.category || "Other",
    triggers: [],
    actions: [],
    standardOutputKeys: STANDARD_OUTPUT_FIELDS,
  };
}

/**
 * Topologically sorts nodes in the DAG so dependencies execute before dependents
 */
function getExecutionOrder(
  nodes: FlowNode[],
  connections: FlowConnection[]
): { ordered: FlowNode[]; hasCycle: boolean; cycleNodeIds: Set<string> } {
  const inDegree: Map<string, number> = new Map();
  const adjList: Map<string, string[]> = new Map();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjList.set(node.id, []);
  }

  for (const conn of connections) {
    if (inDegree.has(conn.targetNodeId) && adjList.has(conn.sourceNodeId)) {
      inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) || 0) + 1);
      adjList.get(conn.sourceNodeId)?.push(conn.targetNodeId);
    }
  }

  // Queue nodes with in-degree 0 (triggers first, then other roots)
  const queue: FlowNode[] = [];
  const triggerRoots = nodes.filter((n) => (inDegree.get(n.id) || 0) === 0 && n.type === "trigger");
  const otherRoots = nodes.filter((n) => (inDegree.get(n.id) || 0) === 0 && n.type !== "trigger");

  queue.push(...triggerRoots, ...otherRoots);

  const ordered: FlowNode[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    ordered.push(current);

    const neighbors = adjList.get(current.id) || [];
    for (const nextId of neighbors) {
      const remainingDegree = (inDegree.get(nextId) || 1) - 1;
      inDegree.set(nextId, remainingDegree);
      if (remainingDegree <= 0 && !visited.has(nextId)) {
        const nextNode = nodes.find((n) => n.id === nextId);
        if (nextNode) {
          queue.push(nextNode);
        }
      }
    }
  }

  // Detect circular loop / cycle
  const hasCycle = visited.size < nodes.length;
  const cycleNodeIds = new Set<string>();

  // If there are disconnected nodes or cycles, append unvisited nodes
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      cycleNodeIds.add(node.id);
      ordered.push(node);
      visited.add(node.id);
    }
  }

  return { ordered, hasCycle, cycleNodeIds };
}

export async function POST(req: Request) {
  try {
    let body: {
      nodes?: FlowNode[];
      connections?: FlowConnection[];
      triggerInput?: Record<string, unknown>;
    } = {};

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const nodes = Array.isArray(body.nodes) ? body.nodes : [];
    if (nodes.length === 0) {
      return NextResponse.json(
        { error: "No flow nodes provided to simulate." },
        { status: 400 }
      );
    }

    const connections = Array.isArray(body.connections) ? body.connections : [];
    const { ordered: executionOrder, hasCycle, cycleNodeIds } = getExecutionOrder(nodes, connections);

    const context: Record<string, { output: Record<string, unknown> }> = {};
    const steps: SimulationStepResult[] = [];
    let cumulativeDuration = 0;

    for (let i = 0; i < executionOrder.length; i++) {
      const node = executionOrder[i];
      const connector = getConnectorByName(node.connectorName) || createFallbackConnector(node);
      const isCycleNode = cycleNodeIds.has(node.id);

      // Interpolate parameters using upstream context
      const resolvedInputs = interpolateParameters(node.parameters || {}, context);

      // Simulate realistic network/compute duration (12ms - 38ms)
      const stepDuration = 12 + Math.floor(Math.random() * 26);
      cumulativeDuration += stepDuration;

      // Generate realistic mock output
      const output = generateMockOutput(connector, node.selectedOperationId, resolvedInputs);

      // If user provided triggerInput and node is the first trigger, merge it
      if (node.type === "trigger" && body.triggerInput && Object.keys(body.triggerInput).length > 0) {
        output.payload = { ...(output.payload as Record<string, unknown>), ...body.triggerInput };
        output.data = { ...(output.data as Record<string, unknown>), ...body.triggerInput };
      }

      // Store in context for downstream nodes
      context[node.id] = { output };

      const logs: string[] = [
        `[${new Date().toISOString()}] Step #${i + 1} initialized: ${node.label} (${connector.displayName})`,
        `[OP] Operation ID: ${node.selectedOperationId || "default"}`,
        `[INPUT] Resolved parameters: ${JSON.stringify(resolvedInputs)}`,
        `[OUTPUT] Produced keys: [${Object.keys(output).join(", ")}]`,
      ];

      if (isCycleNode) {
        logs.push(
          `[WARN] Circular loop detected in flow connections involving step "${node.label}" (${node.id}). Dependency order resolved safely.`
        );
      }

      logs.push(`[SUCCESS] Step #${i + 1} completed in ${stepDuration}ms with HTTP 200 OK`);

      steps.push({
        stepNumber: i + 1,
        nodeId: node.id,
        nodeLabel: node.label,
        connectorName: connector.name,
        connectorDisplayName: connector.displayName,
        connectorLogoUrl: connector.logoUrl,
        operationId: node.selectedOperationId,
        type: node.type,
        status: isCycleNode ? "warning" : "success",
        durationMs: stepDuration,
        resolvedInputs,
        output,
        logs,
      });
    }

    const result: SimulationResult = {
      success: true,
      totalDurationMs: cumulativeDuration,
      executedAt: new Date().toISOString(),
      steps,
      hasCycle,
      cycleWarning: hasCycle
        ? "Circular connection detected in your flow. Steps were safely ordered to prevent infinite loops."
        : undefined,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Simulation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Flow simulation failed" },
      { status: 500 }
    );
  }
}
