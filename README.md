# INGR

<div align="center">

**The Open-Source, Zero-Jargon Workflow & Cloud Orchestrator**  
*Connect free-tier internet services, automate workflows, and build pipelines with zero code and 100% data sovereignty.*

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/Tests-155%20Passing-emerald.svg)](./TEST_READY.md)
[![Connectors](https://img.shields.io/badge/Connectors-4%2C760%2B-purple.svg)](#supported-connectors)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.3-black.svg)](https://nextjs.org/)

[Quickstart](#quickstart) • [Magic Prompt Engine](#magic-prompt-engine) • [Flow Studio](#visual-recipe-flow-studio) • [Self-Hosting](#self-hosting--privacy) • [Contributing](#contributing)

</div>

---

## Why INGR?

Most integration platforms are either **expensive cloud subscription services** that store your API keys on someone else's servers or **over-complicated developer tools** packed with technical jargon like cron expressions, idempotency keys, and payload webhooks.

**INGR is built differently:**
- **100% Self-Hosted & Private**: Your API keys and credentials stay on your machine. No third-party data tracking, no telemetry, and zero server bills.
- **Zero-Jargon Simplicity**: Built for creators, founders, game clans, and builders. Plain English throughout—never confusing tech buzzwords.
- **Zero-Cost Magic Prompt**: Type what you want in plain English (*"When Clash of Clans war ends, post to Discord and Sheets"*), and INGR automatically builds, routes, and wires your workflow in <5ms—with **$0.00** in AI API fees.
- **4,760+ Universal Connectors**: From gaming and 3D creative engines to enterprise communication and cloud infrastructure.

---

## Key Features

### ✨ Magic Prompt Engine (Zero-Cost Intent Parser)
Describe any workflow naturally. INGR decomposes your intent into triggers, action chains, and data mappings, auto-wiring the canvas nodes without requiring an external paid LLM.
- *"When Clash of Clans clan war ends, post stats to Discord and save in Google Sheets"*
- *"When a GitHub pull request is merged, deploy to Cloudflare and notify Slack"*
- *"When Uptime Kuma detects downtime, ping Discord alert"*
- *"Google Drive upload → Blender 3D render → Telegram notification"*

### 🎨 Visual Flow Studio
- **Apple-Grade Canvas**: Interactive cubic Bézier curves, glowing wires, particle simulation pulses, and 60 FPS pan/zoom.
- **Dual View Modes**: Switch seamlessly between an infinite visual canvas and a distraction-free linear step-by-step view.
- **Data Pill Wiring**: Drag or insert upstream data outputs (`{{step_1.data}}`, `{{step_1.id}}`) directly into downstream inputs with zero JSON syntax.
- **Instant Simulation Inspector**: Run mock executions across DAGs with millisecond step timing breakdowns and circular loop protection.

### 🔌 4,760+ Supported Connectors
- **Gaming & Community**: Clash of Clans, Discord, Telegram, Minecraft, Steam, Twitch, Reddit.
- **Creative & 3D**: Blender Headless Render, Canva, Cloudflare R2, Image & Asset pipelines.
- **Developer & Cloud**: GitHub, GitLab, Cloudflare Pages, Oracle Cloud, Supabase, Webhooks.
- **Productivity & Office**: Google Sheets, Notion, Airtable, Slack, Gmail, Resend, Linear, Trello.
- **E-Commerce & Billing**: Stripe, Shopify, HubSpot, Mailchimp.

---

## Quickstart

Run INGR locally in seconds. All you need is **Node.js 20+**.

```bash
# 1. Clone the repository
git clone https://github.com/Zavitr/INGR.git
cd INGR/web

# 2. Install dependencies
npm install

# 3. Start your local private instance
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.  
No account creation, sign-up, or credit card required. You will be taken straight into your local workspace.

---

## Self-Hosting & Privacy

INGR is designed from the ground up for **data sovereignty**:
1. **Local Vaulting**: When running self-hosted, your API tokens (Cloudflare, Supabase, Discord, etc.) are vaulted locally in your own environment.
2. **No Data Snooping**: Workflow executions, payloads, and simulated data never pass through external telemetry relays.
3. **Public Demo Sandbox**: If testing on the public preview (`ingr.vercel.app`), simulations run in an ephemeral sandbox so your production keys are never exposed.

---

## Architecture

```
INGR Platform
├── web/                           # Next.js 15+ App Router Frontend & API
│   ├── app/                       # Routes: Landing, /protected, /auth, /api
│   ├── components/                # React components & UI design system
│   │   └── recipes/flow-builder/  # Canvas, Linear Stepper, Spotlight, Magic Bar
│   └── lib/                       # Core orchestration logic
│       ├── recipes/               # Flow types, universal connectors, simulation DAG
│       └── pieces-catalog.json    # Local index of 4,760+ connectors
├── engine/                        # Automation runner integration contracts
├── scripts/                       # Maintenance and catalog utilities
└── tests/                         # 155-test E2E & adversarial security harness
```

---

## Running Verification Tests

INGR ships with a comprehensive multi-tier test suite verifying route integrity, tenant boundaries, and simulation stress:

```bash
# Run all 155 platform tests across all 4 tiers
node tests/e2e/runner.mjs

# Run visual flow builder stress & cycle detection
node tests/adversarial/adversarial_flow_builder_stress.mjs

# Run deterministic magic prompt engine verification
node tests/adversarial/adversarial_flow_prompt_engine.mjs
```

---

## Contributing

We welcome community contributions, new connector presets, and bug fixes!
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/cool-new-connector`).
3. Commit your changes (`git commit -m "feat: add support for XYZ connector"`).
4. Verify tests pass (`node tests/e2e/runner.mjs`).
5. Open a Pull Request.

---

## License

INGR is licensed under the **[Apache License 2.0](./LICENSE)**.  
You are free to use, modify, distribute, and self-host INGR privately or commercially.

*Disclaimer: Third-party trademarks and logos belong to their respective owners. Integrations are independent connectors developed under fair-use interoperability principles and do not imply official affiliation or endorsement.*
