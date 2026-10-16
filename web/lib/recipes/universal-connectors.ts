import catalogData from "../pieces-catalog.json";
import type {
  UniversalConnector,
  ConnectorTrigger,
  ConnectorAction,
  OutputDataField,
} from "./flow-types";

export interface RawCatalogItem {
  name: string;
  displayName: string;
  description: string;
  logoUrl: string;
  version: string;
  category: string;
}

// Standard output fields exposed across EVERY connector
export const STANDARD_OUTPUT_FIELDS: OutputDataField[] = [
  { key: "data", label: "Full Response Data", type: "object", description: "Complete response payload object from connector" },
  { key: "id", label: "Record / Event ID", type: "string", example: "evt_94a7e2b1", description: "Unique identifier for this event or created record" },
  { key: "status", label: "Status", type: "string", example: "success", description: "Execution or delivery status" },
  { key: "payload", label: "Message / Payload", type: "object", description: "Primary message or event body" },
  { key: "url", label: "Resource URL", type: "string", example: "https://example.com/item/123", description: "Direct web link to the created or updated resource" },
  { key: "title", label: "Title / Name", type: "string", example: "New Notification Event", description: "Human-readable label or headline" },
  { key: "author", label: "Author / Sender", type: "string", example: "System", description: "User or service that produced this record" },
  { key: "timestamp", label: "Timestamp", type: "string", example: "2026-10-15T18:00:00.000Z", description: "ISO timestamp of event occurrence" },
];

/**
 * Universal Trigger / Action generation tailored to connector domain
 */
function generateConnectorOperations(item: RawCatalogItem): {
  triggers: ConnectorTrigger[];
  actions: ConnectorAction[];
  extraOutputs: OutputDataField[];
} {
  const cat = (item.category || "").toLowerCase();
  const name = (item.name || "").toLowerCase();
  const desc = (item.description || "").toLowerCase();

  const triggers: ConnectorTrigger[] = [];
  const actions: ConnectorAction[] = [];
  const extraOutputs: OutputDataField[] = [];

  // 1. Gaming & Esports
  if (
    cat.includes("gaming") ||
    name.includes("clash") ||
    name.includes("chess") ||
    name.includes("minecraft") ||
    name.includes("fortnite") ||
    name.includes("steam") ||
    name.includes("roblox") ||
    name.includes("riot") ||
    desc.includes("game")
  ) {
    triggers.push(
      {
        id: "game_event_received",
        name: "Game Event / Clan War Alert",
        description: `Fires whenever a new in-game event, clan war, battle log, or match finishes in ${item.displayName}.`,
        parameters: [
          { key: "clanOrPlayerTag", label: "Clan / Player Tag", type: "text", placeholder: "#2PP0VUY9", description: "Tag or ID to watch for events" },
          { key: "eventType", label: "Event Filter", type: "select", defaultValue: "all", options: [{ label: "All Events", value: "all" }, { label: "War Started / Finished", value: "war" }, { label: "Member Joined / Promoted", value: "member" }, { label: "Match Result", value: "match" }] }
        ],
        outputSchema: [
          ...STANDARD_OUTPUT_FIELDS,
          { key: "playerTag", label: "Player Tag", type: "string", example: "#PLAYER123", description: "Tag of the associated player" },
          { key: "clanTag", label: "Clan Tag", type: "string", example: "#CLAN999", description: "Clan tag of the event" },
          { key: "score", label: "Score / Trophies", type: "number", example: 4200, description: "Player or clan score rating" },
        ]
      },
      {
        id: "scheduled_leaderboard_poll",
        name: "Scheduled Stats Refresh",
        description: `Polls ${item.displayName} on a schedule to fetch latest rankings, tournament standings, and stats.`,
        parameters: [
          { key: "interval", label: "Poll Interval", type: "select", defaultValue: "15m", options: [{ label: "Every 5 Minutes", value: "5m" }, { label: "Every 15 Minutes", value: "15m" }, { label: "Every Hour", value: "1h" }, { label: "Daily", value: "24h" }] },
          { key: "targetLeaderboard", label: "Leaderboard or League", type: "text", placeholder: "Legend League / Blitz Top 100", defaultValue: "Global Top" }
        ],
        outputSchema: STANDARD_OUTPUT_FIELDS
      }
    );

    actions.push(
      {
        id: "send_game_command_or_message",
        name: "Send In-Game Command / Announcement",
        description: `Execute a server RCON command, post an in-game clan mail, or trigger a game broadcast in ${item.displayName}.`,
        parameters: [
          { key: "commandOrMessage", label: "Command or Announcement Text", type: "textarea", required: true, placeholder: "say [INGR] Clan War Victory announced!", description: "Message or command to execute. Supports {{node_id.key}} data pills." },
          { key: "targetChannel", label: "Target World / Clan ID", type: "text", placeholder: "main_lobby / #CLAN", defaultValue: "default" }
        ],
        outputSchema: STANDARD_OUTPUT_FIELDS
      },
      {
        id: "fetch_game_telemetry",
        name: "Fetch Live Player / Clan Telemetry",
        description: `Query fresh statistics, match history, and chest/item rotations from ${item.displayName}.`,
        parameters: [
          { key: "queryIdentifier", label: "Tag or Username", type: "text", required: true, placeholder: "Enter tag or player name", defaultValue: "global" }
        ],
        outputSchema: STANDARD_OUTPUT_FIELDS
      }
    );

    extraOutputs.push(
      { key: "gameTelemetry", label: "Game Telemetry Object", type: "object", description: "Raw game metrics, match summary, or clan score" }
    );
  }
  // 2. Creative & 3D Design
  else if (
    cat.includes("creative") ||
    name.includes("blender") ||
    name.includes("photoshop") ||
    name.includes("illustrator") ||
    name.includes("lightroom") ||
    name.includes("frameio") ||
    name.includes("figma") ||
    name.includes("render") ||
    desc.includes("render")
  ) {
    triggers.push(
      {
        id: "render_or_export_ready",
        name: "3D Render / Export Completed",
        description: `Fires when a 3D scene, graphic composition, or video export finishes processing in ${item.displayName}.`,
        parameters: [
          { key: "projectFile", label: "Project / Scene Name", type: "text", placeholder: "hero_scene.blend / poster.psd", defaultValue: "default_project" }
        ],
        outputSchema: [
          ...STANDARD_OUTPUT_FIELDS,
          { key: "renderUrl", label: "Rendered Asset URL", type: "string", example: "https://r2.pages.dev/renders/scene_001.mp4", description: "Public or CDN link to generated file" },
          { key: "resolution", label: "Resolution", type: "string", example: "1920x1080", description: "Dimensions of exported graphic" },
          { key: "durationSeconds", label: "Render Duration (s)", type: "number", example: 42, description: "Total rendering time in seconds" }
        ]
      }
    );

    actions.push(
      {
        id: "trigger_render_job",
        name: "Trigger Headless 3D Render / Job",
        description: `Dispatch a render job or automated layer export in ${item.displayName}.`,
        parameters: [
          { key: "sceneAssetUrl", label: "Source File / Scene URL", type: "text", required: true, placeholder: "https://storage.pages.dev/assets/model.glb", description: "Scene or template URL. Supports upstream {{node_id.url}}." },
          { key: "renderPreset", label: "Render Preset", type: "select", defaultValue: "cycles_fast", options: [{ label: "Cycles Ultra (High Quality)", value: "cycles_ultra" }, { label: "EEVEE Next (Real-Time Fast)", value: "eevee_fast" }, { label: "PNG High-Res Banner", value: "png_banner" }] },
          { key: "outputDestination", label: "Cloud Output Target", type: "text", defaultValue: "cloudflare-r2-exports", placeholder: "Bucket or folder path" }
        ],
        outputSchema: [
          ...STANDARD_OUTPUT_FIELDS,
          { key: "renderUrl", label: "Rendered Asset URL", type: "string", example: "https://r2.pages.dev/renders/scene_001.mp4", description: "Link to exported file" }
        ]
      },
      {
        id: "apply_graphic_transform",
        name: "Generate Social Banner / Graphic",
        description: `Automate graphic creation, text overlay replacement, or asset export in ${item.displayName}.`,
        parameters: [
          { key: "headlineText", label: "Headline / Graphic Copy", type: "text", required: true, placeholder: "Victory Royale! / New Release v2.0", description: "Text to insert into graphic. Supports {{node_id.title}}." },
          { key: "backgroundImageUrl", label: "Background Image URL", type: "text", placeholder: "https://...", description: "Optional background image. Supports {{node_id.url}}." }
        ],
        outputSchema: STANDARD_OUTPUT_FIELDS
      }
    );
  }
  // 3. Communication (Discord, Slack, Telegram, WhatsApp, Email, Twilio, etc.)
  else if (
    cat.includes("communication") ||
    name.includes("discord") ||
    name.includes("slack") ||
    name.includes("telegram") ||
    name.includes("whatsapp") ||
    name.includes("email") ||
    name.includes("mail") ||
    name.includes("twilio") ||
    desc.includes("chat")
  ) {
    triggers.push(
      {
        id: "message_received",
        name: "New Message or Mention",
        description: `Fires whenever a new message, channel mention, or command is received in ${item.displayName}.`,
        parameters: [
          { key: "channelId", label: "Channel / Room ID", type: "text", placeholder: "#general / 123456789", defaultValue: "general" },
          { key: "keywordFilter", label: "Keyword Filter", type: "text", placeholder: "e.g. !build, alert, war", description: "Optional trigger word filter" }
        ],
        outputSchema: [
          ...STANDARD_OUTPUT_FIELDS,
          { key: "channelId", label: "Channel ID", type: "string", example: "C01234567", description: "ID of channel" },
          { key: "messageText", label: "Message Text", type: "string", example: "Hello from community!", description: "Plain text content" }
        ]
      }
    );

    actions.push(
      {
        id: "send_message",
        name: "Send Message or Notification",
        description: `Post a formatted message, rich embed card, or alert to ${item.displayName}.`,
        parameters: [
          { key: "channelOrRecipient", label: "Channel or Recipient", type: "text", required: true, placeholder: "#announcements or user@example.com", defaultValue: "general" },
          { key: "messageContent", label: "Message Content", type: "textarea", required: true, placeholder: "Automated notification: {{node_1.title}} is now ready! View: {{node_1.url}}", description: "Message text. Use {{node_id.key}} pills." },
          { key: "attachedMediaUrl", label: "Attached Media / Image URL", type: "text", placeholder: "{{node_1.renderUrl}}", description: "Optional media or image to embed." }
        ],
        outputSchema: STANDARD_OUTPUT_FIELDS
      }
    );
  }
  // 4. Developer & Cloud (GitHub, GitLab, Docker, Cloudflare, AWS, Supabase, Postgres, Vercel, Sentry, etc.)
  else if (
    cat.includes("developer") ||
    name.includes("github") ||
    name.includes("gitlab") ||
    name.includes("docker") ||
    name.includes("cloudflare") ||
    name.includes("aws") ||
    name.includes("vercel") ||
    name.includes("sentry") ||
    desc.includes("api")
  ) {
    triggers.push(
      {
        id: "dev_event_pushed",
        name: "Code Push / Issue / Deployment",
        description: `Fires on code commits, branch updates, issue filings, or release deployments in ${item.displayName}.`,
        parameters: [
          { key: "repository", label: "Repository / Project Name", type: "text", placeholder: "org/repo-name", defaultValue: "main" },
          { key: "branch", label: "Branch", type: "text", placeholder: "main", defaultValue: "main" }
        ],
        outputSchema: [
          ...STANDARD_OUTPUT_FIELDS,
          { key: "commitHash", label: "Commit SHA", type: "string", example: "a4f89b1", description: "Git commit hash" },
          { key: "branch", label: "Branch Name", type: "string", example: "main", description: "Target branch" },
          { key: "commitMessage", label: "Commit Message", type: "string", example: "feat: automated build", description: "Git log commit message" }
        ]
      }
    );

    actions.push(
      {
        id: "trigger_workflow_or_action",
        name: "Trigger Pipeline / Deploy Worker",
        description: `Dispatch a build action, deploy an edge worker, or create an issue in ${item.displayName}.`,
        parameters: [
          { key: "actionType", label: "Action Type", type: "select", defaultValue: "deploy", options: [{ label: "Deploy Worker / Code", value: "deploy" }, { label: "Create Issue / Ticket", value: "issue" }, { label: "Trigger Dispatch Event", value: "dispatch" }] },
          { key: "payloadData", label: "Action Parameters / Message", type: "textarea", placeholder: "Automated trigger from {{node_1.author}}", defaultValue: "Triggered from Recipe Flow" }
        ],
        outputSchema: STANDARD_OUTPUT_FIELDS
      }
    );
  }
  // 5. AI & Machine Learning
  else if (
    cat.includes("ai") ||
    name.includes("openai") ||
    name.includes("anthropic") ||
    name.includes("claude") ||
    name.includes("gemini") ||
    name.includes("mistral") ||
    name.includes("elevenlabs") ||
    desc.includes("model")
  ) {
    triggers.push(
      {
        id: "ai_generation_completed",
        name: "AI Output Ready",
        description: `Fires when a scheduled AI agent synthesis or batch generation finishes in ${item.displayName}.`,
        parameters: [
          { key: "modelName", label: "Model Identifier", type: "text", placeholder: "gpt-4o / claude-3-5-sonnet", defaultValue: "default" }
        ],
        outputSchema: [
          ...STANDARD_OUTPUT_FIELDS,
          { key: "generatedText", label: "Generated Text", type: "string", example: "Here is the summary...", description: "AI output response" },
          { key: "tokensUsed", label: "Tokens Used", type: "number", example: 340, description: "Token usage count" }
        ]
      }
    );

    actions.push(
      {
        id: "prompt_ai_model",
        name: "Prompt AI Model / Generate Response",
        description: `Send dynamic prompt with upstream data pills to ${item.displayName} to generate text, analysis, code, or images.`,
        parameters: [
          { key: "prompt", label: "Prompt Instructions", type: "textarea", required: true, placeholder: "Summarize this incoming event: {{node_1.payload}} and create a concise alert.", description: "Prompt string. Use {{node_id.key}} data pills." },
          { key: "systemInstructions", label: "System Persona", type: "text", placeholder: "You are a professional assistant.", defaultValue: "You are a helpful automation assistant." }
        ],
        outputSchema: [
          ...STANDARD_OUTPUT_FIELDS,
          { key: "generatedText", label: "Generated Text", type: "string", example: "Automated summary...", description: "AI generated response" }
        ]
      }
    );
  }
  // 6. Databases & Storage
  else if (
    cat.includes("database") ||
    cat.includes("storage") ||
    name.includes("supabase") ||
    name.includes("postgres") ||
    name.includes("mysql") ||
    name.includes("redis") ||
    name.includes("mongodb") ||
    name.includes("r2") ||
    name.includes("s3")
  ) {
    triggers.push(
      {
        id: "database_record_changed",
        name: "New or Updated Record",
        description: `Fires when a new row is inserted or updated in ${item.displayName}.`,
        parameters: [
          { key: "tableName", label: "Table / Bucket Name", type: "text", required: true, placeholder: "events / records / assets", defaultValue: "events" }
        ],
        outputSchema: STANDARD_OUTPUT_FIELDS
      }
    );

    actions.push(
      {
        id: "insert_database_record",
        name: "Insert Record / Upload Object",
        description: `Store structured JSON record or upload binary blob to ${item.displayName}.`,
        parameters: [
          { key: "destinationTable", label: "Target Table / Key", type: "text", required: true, placeholder: "records / uploads/file.json", defaultValue: "records" },
          { key: "recordContent", label: "Record Data / JSON", type: "textarea", required: true, placeholder: '{"source": "{{node_1.id}}", "url": "{{node_1.url}}", "status": "processed"}', description: "JSON or text to store. Supports {{node_id.key}} pills." }
        ],
        outputSchema: STANDARD_OUTPUT_FIELDS
      }
    );
  }
  // 7. Social & Creators (Twitter/X, YouTube, TikTok, Instagram, LinkedIn, Twitch, Pinterest, etc.)
  else if (
    cat.includes("social") ||
    cat.includes("creator") ||
    name.includes("twitter") ||
    name.includes("youtube") ||
    name.includes("tiktok") ||
    name.includes("instagram") ||
    name.includes("twitch") ||
    name.includes("linkedin") ||
    name.includes("pinterest") ||
    desc.includes("social")
  ) {
    triggers.push(
      {
        id: "social_post_or_event",
        name: "New Post, Mention, or Follower",
        description: `Fires on new content uploads, mentions, comments, or audience milestones in ${item.displayName}.`,
        parameters: [
          { key: "accountOrHandle", label: "Channel or Handle", type: "text", placeholder: "@username / channel_id", defaultValue: "main" },
          { key: "filterTag", label: "Tag or Keyword Filter", type: "text", placeholder: "#release, @mention", description: "Optional filter tag" }
        ],
        outputSchema: [
          ...STANDARD_OUTPUT_FIELDS,
          { key: "postUrl", label: "Live Post URL", type: "string", example: "https://x.com/user/status/1848201", description: "Direct URL of post" },
          { key: "content", label: "Post Text Content", type: "string", example: "Check out our latest update!", description: "Content of publication" },
          { key: "likes", label: "Like Count", type: "number", example: 120, description: "Total reactions" },
          { key: "engagementScore", label: "Engagement Score", type: "number", example: 850, description: "Metric score" },
        ]
      }
    );

    actions.push(
      {
        id: "publish_social_post",
        name: "Publish Broadcast / Social Post",
        description: `Create and publish a post, media link, or live update to ${item.displayName}.`,
        parameters: [
          { key: "postContent", label: "Post Content / Caption", type: "textarea", required: true, placeholder: "📢 {{step_1.title}} is live! Check it out: {{step_1.url}}", description: "Text to post. Supports upstream {{node_id.key}} pills." },
          { key: "mediaUrl", label: "Media / Banner URL", type: "text", placeholder: "{{step_1.renderUrl}}", description: "Optional media asset URL" }
        ],
        outputSchema: [
          ...STANDARD_OUTPUT_FIELDS,
          { key: "postUrl", label: "Live Post URL", type: "string", example: "https://platform.com/post/9941", description: "Direct URL of published post" },
        ]
      }
    );

    extraOutputs.push(
      { key: "postUrl", label: "Live Post URL", type: "string", example: "https://platform.com/post/9941", description: "Direct link" }
    );
  }
  // 8. Productivity & Collaboration (Notion, Trello, Jira, Asana, Linear, ClickUp, Monday, Google Workspace)
  else if (
    cat.includes("productivity") ||
    name.includes("notion") ||
    name.includes("trello") ||
    name.includes("jira") ||
    name.includes("linear") ||
    name.includes("asana") ||
    name.includes("clickup") ||
    name.includes("monday") ||
    name.includes("google") ||
    desc.includes("task")
  ) {
    triggers.push(
      {
        id: "task_or_doc_updated",
        name: "Task / Page Created or Status Changed",
        description: `Fires when a new task, ticket, document, or card is created or changed in ${item.displayName}.`,
        parameters: [
          { key: "workspaceOrProject", label: "Project or Board ID", type: "text", placeholder: "General / Sprint-42", defaultValue: "main" },
          { key: "statusFilter", label: "Status Filter", type: "select", defaultValue: "all", options: [{ label: "All Events", value: "all" }, { label: "Completed / Done", value: "done" }, { label: "In Progress", value: "progress" }] }
        ],
        outputSchema: [
          ...STANDARD_OUTPUT_FIELDS,
          { key: "taskId", label: "Task / Ticket ID", type: "string", example: "PROJ-102", description: "Unique task key" },
          { key: "taskTitle", label: "Task Title", type: "string", example: "Implement Flow Studio UI", description: "Task headline" },
          { key: "taskStatus", label: "Status", type: "string", example: "In Progress", description: "Current lifecycle state" },
          { key: "assignee", label: "Assignee", type: "string", example: "Dev Team", description: "Assigned member" }
        ]
      }
    );

    actions.push(
      {
        id: "create_or_update_task",
        name: "Create / Update Task or Page",
        description: `Add a new issue, card, or document to ${item.displayName}.`,
        parameters: [
          { key: "taskTitle", label: "Task / Page Title", type: "text", required: true, placeholder: "Review {{step_1.title}} (ID: {{step_1.id}})", description: "Title of record. Supports {{node_id.key}}." },
          { key: "taskDescription", label: "Description / Notes", type: "textarea", placeholder: "Generated from automated flow: {{step_1.url}}", defaultValue: "Automated recipe task." },
          { key: "priority", label: "Priority", type: "select", defaultValue: "high", options: [{ label: "High", value: "high" }, { label: "Medium", value: "medium" }, { label: "Low", value: "low" }] }
        ],
        outputSchema: [
          ...STANDARD_OUTPUT_FIELDS,
          { key: "taskId", label: "Task ID", type: "string", example: "PROJ-102", description: "ID of created record" }
        ]
      }
    );

    extraOutputs.push(
      { key: "taskId", label: "Task ID", type: "string", example: "PROJ-102", description: "ID of task" }
    );
  }
  // 9. Business & Finance (Stripe, Shopify, PayPal, QuickBooks, Xero, HubSpot, Salesforce, etc.)
  else if (
    cat.includes("business") ||
    cat.includes("finance") ||
    name.includes("stripe") ||
    name.includes("shopify") ||
    name.includes("paypal") ||
    name.includes("quickbooks") ||
    name.includes("hubspot") ||
    name.includes("salesforce") ||
    desc.includes("payment") ||
    desc.includes("invoice")
  ) {
    triggers.push(
      {
        id: "transaction_or_deal_event",
        name: "Payment, Invoice, or Deal Won",
        description: `Fires on successful charges, invoices paid, new orders, or CRM deal progression in ${item.displayName}.`,
        parameters: [
          { key: "eventType", label: "Event Type", type: "select", defaultValue: "payment_success", options: [{ label: "Payment Succeeded", value: "payment_success" }, { label: "Invoice Created", value: "invoice_created" }, { label: "Deal Won", value: "deal_won" }] }
        ],
        outputSchema: [
          ...STANDARD_OUTPUT_FIELDS,
          { key: "amount", label: "Transaction Amount", type: "number", example: 49.00, description: "Total value" },
          { key: "currency", label: "Currency", type: "string", example: "USD", description: "Currency code" },
          { key: "customerEmail", label: "Customer Email", type: "string", example: "client@example.com", description: "Customer contact" },
          { key: "invoiceId", label: "Invoice / Order ID", type: "string", example: "inv_982b1", description: "Order key" },
        ]
      }
    );

    actions.push(
      {
        id: "create_invoice_or_order",
        name: "Create Invoice / Customer Order",
        description: `Generate an invoice, charge, customer record, or sales deal in ${item.displayName}.`,
        parameters: [
          { key: "customerEmail", label: "Customer Email", type: "text", required: true, placeholder: "{{step_1.customerEmail}} or client@company.com", defaultValue: "customer@example.com" },
          { key: "amount", label: "Amount / Price", type: "number", required: true, defaultValue: 29 },
          { key: "itemDescription", label: "Item / Service Name", type: "text", placeholder: "Subscription / {{step_1.title}}", defaultValue: "Standard Service" }
        ],
        outputSchema: [
          ...STANDARD_OUTPUT_FIELDS,
          { key: "invoiceId", label: "Invoice ID", type: "string", example: "inv_982b1", description: "Identifier of invoice" }
        ]
      }
    );

    extraOutputs.push(
      { key: "amount", label: "Transaction Amount", type: "number", example: 49.00, description: "Amount value" },
      { key: "currency", label: "Currency", type: "string", example: "USD", description: "Currency code" }
    );
  }
  // 10. Universal Fallback for ANY connector in the 4,749+ catalog!
  else {
    triggers.push(
      {
        id: "universal_event_trigger",
        name: "Automated Event Trigger",
        description: `Fires when new activity, webhook, or state change occurs in ${item.displayName}.`,
        parameters: [
          { key: "eventType", label: "Event Type Filter", type: "text", placeholder: "all / update", defaultValue: "all" },
          { key: "pollingFrequency", label: "Check Frequency", type: "select", defaultValue: "realtime", options: [{ label: "Realtime Webhook", value: "realtime" }, { label: "Every 5 Minutes", value: "5m" }, { label: "Every 15 Minutes", value: "15m" }] }
        ],
        outputSchema: STANDARD_OUTPUT_FIELDS
      },
      {
        id: "universal_scheduled_poll",
        name: "Scheduled Periodic Check",
        description: `Polls ${item.displayName} periodically to check for new records or telemetry.`,
        parameters: [
          { key: "schedule", label: "Schedule Interval", type: "select", defaultValue: "15m", options: [{ label: "Every 15 Minutes", value: "15m" }, { label: "Every Hour", value: "1h" }, { label: "Daily", value: "24h" }] }
        ],
        outputSchema: STANDARD_OUTPUT_FIELDS
      }
    );

    actions.push(
      {
        id: "universal_send_action",
        name: "Send / Post Data to Service",
        description: `Send automated data, call an API action, or sync information into ${item.displayName}.`,
        parameters: [
          { key: "actionTarget", label: "Action Target / Resource", type: "text", placeholder: "items / updates", defaultValue: "default" },
          { key: "dataContent", label: "Data Payload / Message", type: "textarea", required: true, placeholder: "Data from upstream: {{node_1.title}} (ID: {{node_1.id}})", description: "Content to send. Supports {{node_id.key}} data pills." }
        ],
        outputSchema: STANDARD_OUTPUT_FIELDS
      },
      {
        id: "universal_query_action",
        name: "Search / Query Records",
        description: `Look up or query data records from ${item.displayName}.`,
        parameters: [
          { key: "searchQuery", label: "Search Query", type: "text", placeholder: "Search term or ID", defaultValue: "" }
        ],
        outputSchema: STANDARD_OUTPUT_FIELDS
      }
    );
  }

  return { triggers, actions, extraOutputs };
}

// In-memory indexed connector registry
class UniversalConnectorRegistry {
  private connectors: UniversalConnector[] = [];
  private connectorMap: Map<string, UniversalConnector> = new Map();
  private categories: string[] = [];

  constructor() {
    this.initialize();
  }

  private initialize() {
    const rawList = catalogData as RawCatalogItem[];
    const catSet = new Set<string>();

    this.connectors = rawList.map((item) => {
      const category = item.category || "Other";
      catSet.add(category);

      const ops = generateConnectorOperations(item);
      const connector: UniversalConnector = {
        name: item.name,
        displayName: item.displayName || item.name,
        description: item.description || "Seamless integration connector for INGR Recipe Studio.",
        logoUrl: item.logoUrl || "https://cdn.activepieces.com/pieces/generic.png",
        version: item.version || "1.0.0",
        category,
        triggers: ops.triggers,
        actions: ops.actions,
        standardOutputKeys: [...STANDARD_OUTPUT_FIELDS, ...ops.extraOutputs],
      };

      this.connectorMap.set(item.name.toLowerCase(), connector);
      return connector;
    });

    this.categories = Array.from(catSet).sort();
  }

  public getCount(): number {
    return this.connectors.length;
  }

  public getAllCategories(): string[] {
    return this.categories;
  }

  public getConnector(name: string): UniversalConnector | null {
    if (!name) return null;
    return this.connectorMap.get(name.toLowerCase()) || null;
  }

  /**
   * Ultra-fast (<1ms) multi-key search across all 4,749+ connectors
   */
  public search(
    query: string,
    options?: { category?: string; limit?: number }
  ): UniversalConnector[] {
    const q = (query || "").trim().toLowerCase();
    const category = options?.category;
    const limit = options?.limit || 24;

    const results: UniversalConnector[] = [];
    const exactMatches: UniversalConnector[] = [];
    const prefixMatches: UniversalConnector[] = [];
    const containsMatches: UniversalConnector[] = [];

    for (let i = 0; i < this.connectors.length; i++) {
      const item = this.connectors[i];

      // Category filter check
      if (category && category !== "All" && item.category !== category) {
        continue;
      }

      if (!q) {
        results.push(item);
        if (results.length >= limit) break;
        continue;
      }

      const nameLower = item.name.toLowerCase();
      const displayLower = item.displayName.toLowerCase();
      const descLower = item.description.toLowerCase();

      if (displayLower === q || nameLower === q) {
        exactMatches.push(item);
      } else if (displayLower.startsWith(q) || nameLower.startsWith(q)) {
        prefixMatches.push(item);
      } else if (displayLower.includes(q) || nameLower.includes(q) || descLower.includes(q)) {
        containsMatches.push(item);
      }

      if (exactMatches.length + prefixMatches.length + containsMatches.length >= limit * 2) {
        break;
      }
    }

    if (!q) return results;

    const merged = [...exactMatches, ...prefixMatches, ...containsMatches];
    return merged.slice(0, limit);
  }
}

// Global singleton instance
export const connectorRegistry = new UniversalConnectorRegistry();

/**
 * Public search function with sub-5ms performance
 */
export function searchConnectors(
  query: string,
  options?: { category?: string; limit?: number }
): UniversalConnector[] {
  return connectorRegistry.search(query, options);
}

/**
 * Get connector by unique package name
 */
export function getConnectorByName(name: string): UniversalConnector | null {
  return connectorRegistry.getConnector(name);
}

/**
 * Get all available categories
 */
export function getAllConnectorCategories(): string[] {
  return connectorRegistry.getAllCategories();
}

/**
 * Get total connector count
 */
export function getTotalConnectorCount(): number {
  return connectorRegistry.getCount();
}

/**
 * Get all loaded universal connectors
 */
export function getAllUniversalConnectors(): UniversalConnector[] {
  return connectorRegistry.search("", { limit: 10000 });
}

/**
 * Interpolates parameter strings containing {{step_id.key}} using execution context
 */
export function interpolateString(
  template: string,
  context: Record<string, { output?: Record<string, unknown> } | Record<string, unknown>>
): string {
  if (typeof template !== "string") return template;
  return template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, nodeId, keyPath) => {
    const rawNode = context[nodeId];
    const nodeOutput = (rawNode && typeof rawNode === "object" && "output" in rawNode ? rawNode.output : rawNode) as Record<string, unknown> | undefined;
    if (!nodeOutput || typeof nodeOutput !== "object") return match;

    // Check direct property or nested path
    if (keyPath in nodeOutput) {
      const val = nodeOutput[keyPath];
      return typeof val === "object" ? JSON.stringify(val) : String(val);
    }
    const parts = keyPath.split(".");
    let current: unknown = nodeOutput;
    for (const part of parts) {
      if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return match; // Keep unresolved expression
      }
    }
    return typeof current === "object" ? JSON.stringify(current) : String(current);
  });
}

/**
 * Interpolates an entire parameters record (supports recursive nested objects and arrays)
 */
export function interpolateParameters(
  params: Record<string, unknown>,
  context: Record<string, { output?: Record<string, unknown> } | Record<string, unknown>>
): Record<string, unknown> {
  function resolveValue(val: unknown): unknown {
    if (typeof val === "string") {
      return interpolateString(val, context);
    }
    if (Array.isArray(val)) {
      return val.map(resolveValue);
    }
    if (val !== null && typeof val === "object") {
      const res: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        res[k] = resolveValue(v);
      }
      return res;
    }
    return val;
  }

  const resolved: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    resolved[k] = resolveValue(v);
  }
  return resolved;
}

/**
 * Generates realistic simulated mock outputs for ANY connector during DAG execution
 */
export function generateMockOutput(
  connector: UniversalConnector,
  operationId: string,
  resolvedInputs: Record<string, unknown>
): Record<string, unknown> {
  const cat = connector.category.toLowerCase();
  const name = connector.name.toLowerCase();
  const now = new Date().toISOString();
  const randomHex = Math.random().toString(16).substring(2, 8);

  const baseOutput: Record<string, unknown> = {
    id: `rec_${randomHex}`,
    status: "success",
    timestamp: now,
    author: connector.displayName,
    title: `${connector.displayName} Action Completed`,
    url: `https://${connector.name.replace(/[^a-z0-9]/g, "-")}.pages.dev/event/${randomHex}`,
    data: {
      connector: connector.name,
      operation: operationId,
      executedAt: now,
      inputs: resolvedInputs,
    },
    payload: {
      message: `Successfully processed via ${connector.displayName}`,
      details: resolvedInputs,
    },
  };

  // Tailor simulated outputs to connector domains
  if (cat.includes("gaming") || name.includes("clash") || name.includes("chess") || name.includes("minecraft")) {
    baseOutput.id = `game_${randomHex}`;
    baseOutput.title = `${connector.displayName}: Event Notification`;
    baseOutput.playerTag = (resolvedInputs.clanOrPlayerTag as string) || (resolvedInputs.queryIdentifier as string) || "#2PP0VUY9";
    baseOutput.clanTag = "#CLAN888";
    baseOutput.score = 4250;
    baseOutput.payload = {
      event: "Clan War Victory",
      stars: 45,
      trophiesGained: 32,
      commandExecuted: (resolvedInputs.commandOrMessage as string) || "say [INGR] Event synchronized",
    };
  } else if (cat.includes("creative") || name.includes("blender") || name.includes("photoshop")) {
    baseOutput.id = `rnd_${randomHex}`;
    baseOutput.title = `${connector.displayName}: 3D Render Export`;
    baseOutput.renderUrl = `https://r2.pages.dev/renders/scene_${randomHex}.mp4`;
    baseOutput.resolution = "1920x1080";
    baseOutput.durationSeconds = 18;
    baseOutput.payload = {
      sceneUrl: (resolvedInputs.sceneAssetUrl as string) || "https://pages.dev/scene.blend",
      renderEngine: (resolvedInputs.renderPreset as string) || "Cycles GPU",
      status: "Render Completed (100%)",
    };
  } else if (cat.includes("communication") || name.includes("discord") || name.includes("slack")) {
    baseOutput.id = `msg_${randomHex}`;
    baseOutput.title = `Message delivered to ${(resolvedInputs.channelOrRecipient as string) || "#general"}`;
    baseOutput.channelId = (resolvedInputs.channelOrRecipient as string) || "C01234567";
    baseOutput.messageText = (resolvedInputs.messageContent as string) || "Automated flow alert";
    baseOutput.payload = {
      delivered: true,
      channel: (resolvedInputs.channelOrRecipient as string) || "#general",
      text: (resolvedInputs.messageContent as string) || "Hello from INGR",
    };
  } else if (cat.includes("developer") || name.includes("github") || name.includes("cloudflare")) {
    baseOutput.id = `commit_${randomHex}`;
    baseOutput.title = `Pipeline Triggered on ${(resolvedInputs.repository as string) || "main"}`;
    baseOutput.commitHash = randomHex;
    baseOutput.branch = (resolvedInputs.branch as string) || "main";
    baseOutput.commitMessage = (resolvedInputs.payloadData as string) || "Automated sync from Recipe Flow";
  } else if (cat.includes("ai")) {
    baseOutput.id = `ai_${randomHex}`;
    baseOutput.title = "AI Synthesis Completed";
    baseOutput.generatedText = `[AI Analysis for ${connector.displayName}]: Successfully processed input parameters. All flow conditions verified.`;
    baseOutput.tokensUsed = 245;
  } else if (cat.includes("social") || cat.includes("creator") || name.includes("twitter") || name.includes("youtube")) {
    baseOutput.id = `soc_${randomHex}`;
    baseOutput.title = `${connector.displayName}: Broadcast Published`;
    baseOutput.videoTitle = `${connector.displayName} Spotlight Video`;
    baseOutput.channelTitle = `${connector.displayName} Official`;
    baseOutput.postUrl = `https://${connector.name.replace(/[^a-z0-9]/g, "-")}.com/post/${randomHex}`;
    baseOutput.content = (resolvedInputs.postContent as string) || "Automated post from INGR";
    baseOutput.likes = 142;
    baseOutput.engagementScore = 920;
    baseOutput.payload = {
      published: true,
      platform: connector.displayName,
      url: baseOutput.postUrl,
    };
  } else if (cat.includes("productivity") || name.includes("notion") || name.includes("trello") || name.includes("jira")) {
    baseOutput.id = `task_${randomHex}`;
    baseOutput.taskId = `PROJ-${Math.floor(100 + Math.random() * 900)}`;
    baseOutput.taskTitle = (resolvedInputs.taskTitle as string) || (resolvedInputs.pageTitle as string) || `${connector.displayName} Automated Item`;
    baseOutput.taskStatus = "In Progress";
    baseOutput.assignee = (resolvedInputs.assignee as string) || "Automation Agent";
    baseOutput.pageId = baseOutput.taskId;
    baseOutput.pageTitle = baseOutput.taskTitle;
    baseOutput.title = `${connector.displayName}: Task ${baseOutput.taskId} Created`;
    baseOutput.payload = {
      id: baseOutput.taskId,
      status: "In Progress",
      link: `https://app.${connector.name.replace(/[^a-z0-9]/g, "-")}.com/item/${randomHex}`,
    };
  } else if (cat.includes("business") || cat.includes("finance") || name.includes("stripe") || name.includes("shopify")) {
    baseOutput.id = `tx_${randomHex}`;
    baseOutput.title = `${connector.displayName}: Transaction Processed`;
    baseOutput.amount = typeof resolvedInputs.amount === "number" ? resolvedInputs.amount : 49.00;
    baseOutput.currency = (resolvedInputs.currency as string) || "USD";
    baseOutput.customerEmail = (resolvedInputs.customerEmail as string) || "customer@example.com";
    baseOutput.invoiceId = `inv_${randomHex}`;
    baseOutput.chargeId = `ch_${randomHex}`;
    baseOutput.payload = {
      invoiceId: baseOutput.invoiceId,
      paid: true,
      amount: baseOutput.amount,
      currency: baseOutput.currency,
      email: baseOutput.customerEmail,
    };
  } else if (cat.includes("database") || cat.includes("storage") || name.includes("supabase") || name.includes("postgres")) {
    baseOutput.id = `db_${randomHex}`;
    baseOutput.title = `${connector.displayName}: Record Stored`;
    baseOutput.recordId = `rec_${randomHex}`;
    baseOutput.table = (resolvedInputs.destinationTable as string) || (resolvedInputs.tableName as string) || "events";
    baseOutput.rowCount = 3;
    baseOutput.rows = [
      { id: 1, name: "Sample Item A", status: "active" },
      { id: 2, name: "Sample Item B", status: "pending" },
      { id: 3, name: "Sample Item C", status: "completed" },
    ];
    baseOutput.payload = {
      stored: true,
      table: baseOutput.table,
      recordId: baseOutput.recordId,
      rowsAffected: 1,
    };
  }

  return baseOutput;
}
