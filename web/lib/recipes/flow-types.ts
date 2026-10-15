export type NodeType = "trigger" | "action";

export type FlowViewMode = "canvas" | "linear";

export type ConnectorCategory =
  | "Gaming & Esports"
  | "Creative & 3D Design"
  | "AI & Machine Learning"
  | "Productivity"
  | "Developer & Cloud"
  | "Business & Finance"
  | "Databases & Storage"
  | "Communication"
  | "Social & Creators"
  | "Other";

export interface ConnectorParamDef {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "textarea" | "json";
  required?: boolean;
  defaultValue?: string | number | boolean | Record<string, unknown>;
  placeholder?: string;
  options?: { label: string; value: string }[];
  description?: string;
}

export interface OutputDataField {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  example?: string | number | boolean | Record<string, unknown>;
  description: string;
}

export interface ConnectorTrigger {
  id: string;
  name: string;
  description: string;
  parameters: ConnectorParamDef[];
  outputSchema: OutputDataField[];
}

export interface ConnectorAction {
  id: string;
  name: string;
  description: string;
  parameters: ConnectorParamDef[];
  outputSchema: OutputDataField[];
}

export interface UniversalConnector {
  name: string;
  displayName: string;
  description: string;
  logoUrl: string;
  version: string;
  category: string;
  triggers: ConnectorTrigger[];
  actions: ConnectorAction[];
  standardOutputKeys: OutputDataField[];
}

export interface FlowNode {
  id: string;
  type: NodeType;
  connectorName: string;
  connectorDisplayName: string;
  connectorLogoUrl: string;
  category: string;
  selectedOperationId: string;
  label: string;
  position: { x: number; y: number };
  parameters: Record<string, string | number | boolean | Record<string, unknown>>;
  notes?: string;
}

export interface FlowConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceOutputKey?: string;
  targetInputKey?: string;
}

export interface FlowRecipeDefinition {
  id: string;
  name: string;
  description?: string;
  status?: "active" | "inactive" | "deploying";
  nodes: FlowNode[];
  connections: FlowConnection[];
  viewMode?: FlowViewMode;
  createdAt?: string;
  updatedAt?: string;
}

export interface SimulationStepResult {
  stepNumber: number;
  nodeId: string;
  nodeLabel: string;
  connectorName: string;
  connectorDisplayName: string;
  connectorLogoUrl: string;
  operationId: string;
  type: NodeType;
  status: "success" | "warning" | "error";
  durationMs: number;
  resolvedInputs: Record<string, unknown>;
  output: Record<string, unknown>;
  logs: string[];
  errorMessage?: string;
}

export interface SimulationResult {
  success: boolean;
  totalDurationMs: number;
  executedAt: string;
  steps: SimulationStepResult[];
  hasCycle?: boolean;
  cycleWarning?: string;
  error?: string;
}

export interface SimulationRequest {
  nodes: FlowNode[];
  connections: FlowConnection[];
  triggerInput?: Record<string, unknown>;
}
