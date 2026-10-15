# INGR — Open-Source Landscape Research Report

**Date:** 2026-09-26  
**Purpose:** Identify what existing open-source code we can legally build on top of.

---

## Executive Summary

We researched ~20 open-source projects across workflow automation, backend services, OAuth management, and free-tier aggregation. The verdict is clear:

| Role | Winner | License | Why |
|------|--------|---------|-----|
| **Workflow/Automation Engine** | Activepieces | MIT ✅ | Modular TypeScript, embeddable, commercial use allowed |
| **Backend / Auth / Database** | Supabase | Apache 2.0 / MIT ✅ | Battle-tested, free tier, auth built-in |
| **API Catalog Data** | public-apis repo | MIT ✅ | 483k stars, structured list of free APIs |
| **Free-Tier Service Data** | free-for-dev repo | MIT ✅ | 139k stars, curated list of free services |
| **UX Inspiration** | n8n | ❌ Cannot use code | Best workflow UI in the space, study only |
| **API Connector Patterns** | Appsmith | Apache 2.0 ✅ | Reusable API/DB connector logic |

---

## What We CAN Use (Permissive Licenses)

### 1. Activepieces — Our Primary Foundation
- **GitHub:** https://github.com/activepieces/activepieces
- **License:** MIT (core) — full commercial use, modification, embedding allowed
- **Stars:** ~24k | **Stack:** Full TypeScript, Angular frontend, Node.js backend
- **What it does:** Workflow automation platform (like Zapier). Modular "pieces" system where each integration is a self-contained plugin.
- **Why it's perfect for us:**
  - MIT license means we can fork, modify, embed, white-label, sell — no restrictions
  - The "pieces" architecture is exactly the plugin model we need for service integrations
  - Clean TypeScript codebase, actively maintained
  - Already has connectors for many services
  - Linear step-based UI is more accessible to non-technical users than n8n's node canvas

### 2. Supabase — Backend Infrastructure
- **GitHub:** https://github.com/supabase/supabase
- **License:** Apache 2.0 / MIT
- **Stars:** ~109k | **Stack:** PostgreSQL, Edge Functions, GoTrue (auth)
- **What it does:** Open-source Firebase alternative — database, auth, edge functions, storage
- **Why it's useful:**
  - We can use Supabase Auth for our user authentication (already in the INGR brief)
  - PostgreSQL backend for our platform data
  - Row Level Security for tenant isolation
  - Self-hostable or use their free tier during development

### 3. Appwrite — Alternative Backend (backup option)
- **GitHub:** https://github.com/appwrite/appwrite
- **License:** BSD 3-Clause ✅
- **Stars:** ~57.5k
- **What it does:** Backend-as-a-service (auth, functions, databases, storage)
- **Why it's useful:** More permissive than Supabase (BSD vs Apache), similar feature set

### 4. Node-RED — Embeddable Flow Engine (optional)
- **GitHub:** https://github.com/node-red/node-red
- **License:** Apache 2.0 ✅
- **Stars:** ~23.7k | **Stack:** Node.js
- **What it does:** Flow-based visual programming for wiring services together
- **Why it's useful:** Extremely mature, embeddable, great for IoT/hardware integrations. More technical than Activepieces though.

### 5. Appsmith — Connector Patterns
- **GitHub:** https://github.com/appsmithorg/appsmith
- **License:** Apache 2.0 ✅
- **Stars:** ~40.9k
- **What it does:** Low-code platform for building internal tools
- **Why it's useful:** Their API and database connector logic is Apache-licensed and reusable

### 6. Huginn — Event-Driven Agent Model
- **GitHub:** https://github.com/cantino/huginn
- **License:** MIT ✅
- **Stars:** ~50k | **Stack:** Ruby on Rails (older)
- **What it does:** Agents that watch for events and take actions (like IFTTT)
- **Why it's useful:** Great conceptual model for event-driven automations, but Ruby stack is dated

### 7. free-for-dev — Free Tier Catalog
- **GitHub:** https://github.com/ripienaar/free-for-dev
- **License:** MIT ✅
- **Stars:** ~139k
- **What it does:** Curated list of free-tier cloud services for developers
- **Why it's useful:** We can parse this programmatically to populate our platform's service directory

### 8. public-apis — API Catalog
- **GitHub:** https://github.com/public-apis/public-apis
- **License:** MIT ✅
- **Stars:** ~483k
- **What it does:** Categorized list of free public APIs
- **Why it's useful:** Pre-built dataset for our API integration catalog

---

## What We CANNOT Use (Restrictive Licenses)

| Project | License | Why Not |
|---------|---------|---------|
| **n8n** | Sustainable Use License | Explicitly prohibits offering as a SaaS, white-labeling, or embedding commercially |
| **Nango** | Functional Source License (FSL) | Restricts competing commercial use for 2 years |
| **Automatisch** | AGPL-3.0 | Requires open-sourcing our entire stack if we embed it |
| **Windmill** | AGPL-3.0 | Same AGPL restriction |
| **Budibase** | GPLv3 | Same copyleft restriction |
| **ToolJet** | AGPL-3.0 | Same AGPL restriction |
| **Directus** | BSL (Business Source License) | Non-OSI, commercial restrictions |
| **NocoDB** | AGPL-3.0 | Same AGPL restriction |
| **Pizzly/Bearer** | Elastic License 2.0 | Restrictive commercial use |

> **Note on n8n:** While we cannot use their code, n8n has the best workflow UI in the space. We should study it for design inspiration. Their node/credential architecture is also worth understanding conceptually.

---

## Gap: OAuth/Credential Management

There is **no good permissively-licensed drop-in OAuth manager** available. Nango (FSL) and Pizzly (ELv2) are both restricted.

**Options:**
1. Build a lightweight OAuth management layer ourselves (using standard OAuth2 libraries)
2. Leverage Supabase's identity linking features for provider auth
3. Use Activepieces' built-in credential system (MIT-licensed, already handles OAuth2 flows)

**Recommendation:** Option 3 — Activepieces already handles OAuth token storage, refresh, and the "connect your account" flow. Since it's MIT, we can extract and adapt this.

---

## Recommended Architecture Stack

```
┌─────────────────────────────────────────────────────┐
│                    INGR Platform                     │
├─────────────────────────────────────────────────────┤
│  Frontend        │ Activepieces UI (MIT) + custom   │
│  Workflow Engine  │ Activepieces core (MIT)          │
│  Integrations     │ Activepieces "pieces" (MIT)      │
│  OAuth/Creds      │ Activepieces credential system   │
│  Auth (users)     │ Supabase Auth (Apache 2.0)       │
│  Database         │ PostgreSQL via Supabase           │
│  API Catalog      │ public-apis repo data (MIT)       │
│  Free Tier Guide  │ free-for-dev repo data (MIT)      │
│  DNS/CDN/SSL      │ Cloudflare (free tier)            │
│  Compute          │ Oracle Cloud (free tier)          │
│  Billing          │ Stripe                            │
└─────────────────────────────────────────────────────┘
```

---

*This report follows Project Rule #1: Reuse First, Build Second.*
