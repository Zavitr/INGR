import { searchConnectors, getConnectorByName } from "./universal-connectors";
import type { FlowNode, FlowConnection, UniversalConnector } from "./flow-types";

export interface GeneratedFlowRecipe {
  title: string;
  description: string;
  nodes: FlowNode[];
  connections: FlowConnection[];
  explanation: string;
  confidence: number;
}

// Common connectors mapping keywords to official piece names
const ALIAS_MAP: Record<string, string> = {
  "clash of clans": "@activepieces/piece-clash-of-clans",
  "clash": "@activepieces/piece-clash-of-clans",
  "coc": "@activepieces/piece-clash-of-clans",
  "discord": "@activepieces/piece-discord",
  "slack": "@activepieces/piece-slack",
  "telegram": "@activepieces/piece-telegram-bot",
  "github": "@activepieces/piece-github",
  "notion": "@activepieces/piece-notion",
  "sheets": "@activepieces/piece-google-sheets",
  "google sheets": "@activepieces/piece-google-sheets",
  "google sheet": "@activepieces/piece-google-sheets",
  "gmail": "@activepieces/piece-gmail",
  "resend": "@activepieces/piece-resend",
  "email": "@activepieces/piece-smtp",
  "stripe": "@activepieces/piece-stripe",
  "airtable": "@activepieces/piece-airtable",
  "twitter": "@activepieces/piece-twitter",
  "x": "@activepieces/piece-twitter",
  "linear": "@activepieces/piece-linear",
  "trello": "@activepieces/piece-trello",
  "webhook": "@activepieces/piece-webhook",
  "cloudflare": "publicapi-cloudflare",
  "oracle": "@activepieces/piece-oracle-database",
  "uptime": "@activepieces/piece-uptimerobot",
  "uptime kuma": "@activepieces/piece-uptimerobot",
  "blender": "custom-blender-render",
  "supabase": "@activepieces/piece-supabase",
  "jira": "@activepieces/piece-jira-cloud",
  "hubspot": "@activepieces/piece-hubspot",
  "zendesk": "@activepieces/piece-zendesk",
  "mailchimp": "@activepieces/piece-mailchimp",
  "youtube": "@activepieces/piece-youtube",
  "spotify": "@activepieces/piece-spotify",
  "reddit": "@activepieces/piece-reddit",
  "shopify": "@activepieces/piece-shopify",
};

/**
 * Finds best matching connector for an extracted phrase
 */
function findConnectorForPhrase(phrase: string): UniversalConnector | null {
  const clean = phrase.toLowerCase().trim();
  
  // 1. Direct alias check
  for (const [alias, pkgName] of Object.entries(ALIAS_MAP)) {
    if (clean.includes(alias)) {
      const match = getConnectorByName(pkgName);
      if (match) return match;
    }
  }

  // 2. Search catalog by phrase keywords
  const searchResults = searchConnectors(clean, { limit: 5 });
  if (searchResults.length > 0) {
    return searchResults[0];
  }

  // 3. Match individual words in the phrase
  const words = clean.split(/\s+/).filter((w) => w.length > 3);
  for (const word of words) {
    const wordResults = searchConnectors(word, { limit: 1 });
    if (wordResults.length > 0) {
      return wordResults[0];
    }
  }

  return null;
}

/**
 * Selects the most appropriate trigger operation for a connector based on context
 */
function pickTriggerOperation(connector: UniversalConnector, contextText: string): string {
  const lower = contextText.toLowerCase();
  if (connector.triggers.length === 0) return "default_trigger";

  for (const trig of connector.triggers) {
    const nameLower = trig.name.toLowerCase();
    const idLower = trig.id.toLowerCase();
    if (
      (lower.includes("new") && (nameLower.includes("new") || idLower.includes("new"))) ||
      (lower.includes("create") && (nameLower.includes("created") || idLower.includes("create"))) ||
      (lower.includes("update") && (nameLower.includes("updated") || idLower.includes("update"))) ||
      (lower.includes("message") && nameLower.includes("message")) ||
      (lower.includes("war") && nameLower.includes("war")) ||
      (lower.includes("issue") && nameLower.includes("issue"))
    ) {
      return trig.id;
    }
  }

  return connector.triggers[0]?.id || "default_trigger";
}

/**
 * Selects the most appropriate action operation for a connector based on context
 */
function pickActionOperation(connector: UniversalConnector, contextText: string): string {
  const lower = contextText.toLowerCase();
  if (connector.actions.length === 0) return "default_action";

  for (const act of connector.actions) {
    const nameLower = act.name.toLowerCase();
    const idLower = act.id.toLowerCase();
    if (
      (lower.includes("send") && (nameLower.includes("send") || idLower.includes("send"))) ||
      (lower.includes("post") && (nameLower.includes("post") || idLower.includes("post") || nameLower.includes("send"))) ||
      (lower.includes("create") && (nameLower.includes("create") || idLower.includes("create") || nameLower.includes("insert"))) ||
      (lower.includes("save") && (nameLower.includes("insert") || nameLower.includes("append") || nameLower.includes("create"))) ||
      (lower.includes("log") && (nameLower.includes("append") || nameLower.includes("insert") || nameLower.includes("log"))) ||
      (lower.includes("notify") && (nameLower.includes("notify") || nameLower.includes("send") || nameLower.includes("message")))
    ) {
      return act.id;
    }
  }

  return connector.actions[0]?.id || "default_action";
}

/**
 * Natural language intent parser converting text prompt to visual DAG workflow
 */
export function generateFlowFromPrompt(prompt: string): GeneratedFlowRecipe {
  const rawPrompt = prompt.trim();
  if (!rawPrompt) {
    throw new Error("Prompt cannot be empty");
  }

  // 1. Split into trigger and action intent clauses
  let triggerPhrase = "";
  const actionPhrases: string[] = [];

  // Look for pattern "When X, then Y and Z" or "If X do Y" or "X to Y to Z"
  const whenMatch = rawPrompt.match(/^(?:when(?:ever)?|if|on|every time|once)\s+(.+?)(?:\s+(?:then|and\s+then|do|post|send|create|log|notify|update|trigger)|\s*[,.]|\s*$)/i);
  
  if (whenMatch) {
    triggerPhrase = whenMatch[1];
    const remainingText = rawPrompt.slice(whenMatch[0].length);
    
    // Split remaining into individual action steps
    const actionTokens = remainingText.split(/\s+(?:then|and\s+then|and|also|\+)\s+/i);
    for (const tok of actionTokens) {
      const cleanTok = tok.trim().replace(/^[.,;]+|[.,;]+$/g, "");
      if (cleanTok.length > 2) {
        actionPhrases.push(cleanTok);
      }
    }
  } else if (rawPrompt.includes("->") || rawPrompt.includes("→") || rawPrompt.toLowerCase().includes(" to ")) {
    // Arrow-separated or "to"-separated format (e.g., "Clash of Clans -> Discord -> Sheets")
    const parts = rawPrompt.split(/\s*(?:->|→|\bto\b)\s*/i);
    if (parts.length >= 2) {
      triggerPhrase = parts[0];
      for (let i = 1; i < parts.length; i++) {
        if (parts[i].trim()) actionPhrases.push(parts[i].trim());
      }
    }
  } else {
    // Fallback: search for connectors mentioned across the entire prompt
    triggerPhrase = rawPrompt;
  }

  // 2. Resolve Trigger Connector
  let triggerConnector = findConnectorForPhrase(triggerPhrase);
  if (!triggerConnector) {
    // Fallback to first recognized connector in prompt or Webhook
    triggerConnector = findConnectorForPhrase(rawPrompt) || getConnectorByName("@activepieces/piece-webhook")!;
  }

  // 3. Resolve Action Connectors
  const actionConnectors: { connector: UniversalConnector; phrase: string }[] = [];
  for (const phrase of actionPhrases) {
    const conn = findConnectorForPhrase(phrase);
    if (conn && conn.name !== triggerConnector.name && !actionConnectors.some((a) => a.connector.name === conn.name)) {
      actionConnectors.push({ connector: conn, phrase });
    }
  }

  // If no actions resolved yet, try discovering from the rest of the prompt
  if (actionConnectors.length === 0) {
    const promptLower = rawPrompt.toLowerCase();
    for (const [alias, pkgName] of Object.entries(ALIAS_MAP)) {
      if (promptLower.includes(alias) && pkgName !== triggerConnector.name) {
        const conn = getConnectorByName(pkgName);
        if (conn && !actionConnectors.some((a) => a.connector.name === conn.name)) {
          actionConnectors.push({ connector: conn, phrase: alias });
        }
      }
    }
  }

  // Default fallback action if none detected
  if (actionConnectors.length === 0) {
    const fallbackSlack = getConnectorByName("@activepieces/piece-slack");
    if (fallbackSlack && fallbackSlack.name !== triggerConnector.name) {
      actionConnectors.push({ connector: fallbackSlack, phrase: "notify in slack" });
    } else {
      const fallbackDiscord = getConnectorByName("@activepieces/piece-discord")!;
      actionConnectors.push({ connector: fallbackDiscord, phrase: "send to discord" });
    }
  }

  // 4. Build Nodes
  const nodes: FlowNode[] = [];
  const triggerNodeId = "step_1_trigger";
  const triggerOp = pickTriggerOperation(triggerConnector, triggerPhrase || rawPrompt);

  nodes.push({
    id: triggerNodeId,
    type: "trigger",
    connectorName: triggerConnector.name,
    connectorDisplayName: triggerConnector.displayName,
    connectorLogoUrl: triggerConnector.logoUrl,
    category: triggerConnector.category,
    selectedOperationId: triggerOp,
    label: `${triggerConnector.displayName} Trigger`,
    position: { x: 80, y: 160 },
    parameters: {
      eventFilter: "all_events",
    },
  });

  let prevNodeId = triggerNodeId;
  const connections: FlowConnection[] = [];

  for (let i = 0; i < actionConnectors.length; i++) {
    const item = actionConnectors[i];
    const nodeId = `step_${i + 2}_${item.connector.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    const actionOp = pickActionOperation(item.connector, item.phrase);

    nodes.push({
      id: nodeId,
      type: "action",
      connectorName: item.connector.name,
      connectorDisplayName: item.connector.displayName,
      connectorLogoUrl: item.connector.logoUrl,
      category: item.connector.category,
      selectedOperationId: actionOp,
      label: `${item.connector.displayName} Action`,
      position: { x: 80 + (i + 1) * 420, y: 160 },
      parameters: {
        destinationOrTarget: "default",
        messageContent: `Update from {{${prevNodeId}.data}} (Ref: {{${prevNodeId}.id}})`,
      },
    });

    connections.push({
      id: `conn_${Date.now()}_${i}`,
      sourceNodeId: prevNodeId,
      targetNodeId: nodeId,
      sourceOutputKey: "data",
    });

    prevNodeId = nodeId;
  }

  // 5. Generate descriptive Title
  const chainNames = [triggerConnector.displayName, ...actionConnectors.map((a) => a.connector.displayName)].join(" → ");
  const title = chainNames;
  const description = `Automated flow created from: "${rawPrompt}"`;
  const explanation = `Matched ${nodes.length} connectors (${chainNames}). Trigger outputs are pre-wired with data pills into downstream steps.`;

  return {
    title,
    description,
    nodes,
    connections,
    explanation,
    confidence: 0.95,
  };
}
