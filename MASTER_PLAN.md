# INGR Master Plan

**The Project Bible — Every AI builder reads this before touching a line of code.**

*Last updated: 2026-09-26*

---

## Part 1: What INGR Is

**INGR** is a platform that makes free and open internet services usable by normal people.

There are hundreds of generous free tiers across the internet — Cloudflare gives you free DNS/CDN/hosting, Oracle gives you free servers, OpenRouter gives you free AI, Supabase gives you a free database, GitHub gives you free code hosting. Individually, these are powerful. Combined, they're extraordinary — you could run an entire online business for $0.

**The problem:** only developers know these exist, and only developers can wire them together.

**INGR solves this.** A non-technical user signs up, connects their accounts with one-click OAuth (like how Cline connects to OpenRouter — click a button, authorize, done), and picks from pre-built "recipes" that combine services into useful outcomes. No code. No terminal. No understanding of what an API is.

### The One-Liner
> "INGR is Zapier for free-tier internet services, built for people who don't know what Zapier is."

### Target Customer
- Small business owners who can't afford $200/month in SaaS tools
- Freelancers and creators who want professional infrastructure without hiring a developer
- Non-technical founders who need to prototype cheaply
- Students and side-project builders
- Anyone who's Googled "free website hosting" or "free uptime monitor" and got overwhelmed

### What INGR Is NOT
- Not a developer tool (developers can use Claude Code / Antigravity directly)
- Not another n8n or workflow builder with a node canvas
- Not a "learn to code" platform
- Not a reseller of paid services


---

## Part 2: Core UX Principles

These are non-negotiable. Every feature, screen, and interaction must pass these tests.

### Principle 1: Five-Minute Value
A new user must get real value from INGR within 5 minutes of signing up. If it takes longer, the product has failed. This means:
- Sign-up is one click (Google/GitHub OAuth)
- The dashboard immediately shows what they can do
- Connecting a service is 1-2 clicks (OAuth flow, not "paste your API key and configure these 8 settings")
- Activating a recipe is a guided wizard, not a blank canvas

### Principle 2: No Jargon, Ever
The UI never says "API," "endpoint," "container," "instance," "webhook," or "environment variable." Instead:
- "API key" → "your secret password for this service"
- "Deploy" → "turn on"
- "Instance" → "your copy"
- "Webhook" → "automatic notification"
- "DNS" → "web address settings"
If a technical term must appear (e.g., in an error from an external service), it gets a plain-English tooltip.

### Principle 3: Recipes Over Raw Power
Users don't build workflows from scratch. They pick a **recipe** — a pre-built combination of services that solves a specific problem. Examples:
- "Free Website Hosting" (Cloudflare Pages + custom domain)
- "Free Uptime Monitor" (Uptime Kuma on Oracle Cloud)
- "Free AI Chatbot for My Website" (OpenRouter + Cloudflare Workers)
- "Free Contact Form Backend" (Supabase + email notification)
- "Free Scheduled Backups" (Cloudflare R2 + cron trigger)

Advanced users can eventually customize recipes or build their own, but the default experience is "pick and activate."

### Principle 4: The Cline Pattern for Connecting Services
When a user needs to connect a service (e.g., Cloudflare), they see:
1. A brief explanation: "Cloudflare gives you free web hosting, security, and a fast network."
2. Two buttons:
   - **"I already have an account"** → OAuth flow or guided API key entry
   - **"Get a free account"** → Opens the service's signup page, then returns to INGR
3. After connecting, a green checkmark. Done. Never ask again.

### Principle 5: Progressive Disclosure
Show only what's needed at each step. Don't dump 50 services on a new user. Start with:
- "What do you want to do?" (host a website / monitor uptime / add AI to something / store files / etc.)
- Show only the relevant recipes
- Each recipe shows only the services it needs
- Advanced options are hidden behind "Show more" toggles


---

## Part 3: Technical Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     USER'S BROWSER                           │
│  Next.js Frontend (custom INGR UI)                           │
│  - Landing page, dashboard, recipe wizard, account settings  │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼───────────────────────────────────────┐
│                   INGR BACKEND                                │
│                                                               │
│  ┌─────────────────┐  ┌──────────────────────────────────┐   │
│  │  Next.js API     │  │  Activepieces Engine (MIT)       │   │
│  │  Routes          │  │  - Workflow execution             │   │
│  │  - Auth logic    │  │  - 760+ service connectors        │   │
│  │  - Billing logic │  │  - OAuth/credential management    │   │
│  │  - Recipe mgmt   │  │  - Runs as headless API server    │   │
│  └────────┬─────────┘  └──────────┬───────────────────────┘   │
│           │                       │                           │
│  ┌────────▼───────────────────────▼───────────────────────┐   │
│  │              Supabase (PostgreSQL)                      │   │
│  │  - User accounts & auth (GoTrue)                        │   │
│  │  - Platform data (recipes, connected accounts, usage)   │   │
│  │  - Row Level Security for tenant isolation              │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   Cloudflare      Oracle Cloud    Stripe
   (DNS/CDN)       (Compute)       (Billing)
```

### Tech Stack Decisions (with plain-English rationale)

| Component | Choice | Why (plain English) |
|-----------|--------|---------------------|
| **Frontend framework** | Next.js (React) | Most popular web framework. Huge ecosystem of ready-made components. Good for SEO (search engines can read our landing page). Works with Supabase out of the box. |
| **Backend** | Next.js API routes + Activepieces API | Next.js can serve both the website AND the backend logic in one project. Activepieces runs alongside it as the automation engine — we talk to it via its REST API. |
| **Database** | PostgreSQL via Supabase | Industry-standard database. Supabase wraps it with authentication, real-time features, and security rules. Free tier is generous (500MB, 50k monthly active users). |
| **User authentication** | Supabase Auth | Handles sign-up, login, password reset, OAuth (Google, GitHub) out of the box. Security-sensitive code we should never write ourselves. |
| **Workflow/automation engine** | Activepieces (self-hosted, MIT) | MIT license = we can use it commercially for free. 760+ existing service connectors. Has its own credential/OAuth management. We run it in "headless" mode (API only, no UI) and build our own simpler UI on top. |
| **Credential storage** | Activepieces credential system | Already handles OAuth token storage, automatic refresh, and the "connect your account" flow for 760+ services. MIT licensed, so we can use it freely. |
| **DNS / CDN / SSL** | Cloudflare (free tier) | Free SSL certificates, fast global network, DDoS protection, wildcard subdomains. Industry standard. |
| **Compute / hosting** | Oracle Cloud Always Free tier | 2 free virtual machines with 24GB RAM total. More than enough for early-stage. Runs our Docker containers. |
| **Billing** | Stripe | Industry standard for accepting payments online. Well-documented, battle-tested. |
| **Customer support chat** | Crisp (free tier) | Free for up to 2 team members. Embeds as a chat widget. Sends push notifications to your phone. |
| **Backups** | Cloudflare R2 (free tier) | 10GB free storage. No egress fees (meaning: no charges when you download your backups). |
| **CSS / styling** | Tailwind CSS | Utility-first CSS framework. Makes it fast to build good-looking UIs without writing custom CSS from scratch. Included in the Next.js + Supabase starter template. |

### Why Activepieces in Headless Mode?

Activepieces has its own web UI (built in Angular), but it looks like a workflow automation tool — which is exactly what we DON'T want our users to see. Instead:

1. We run Activepieces as a **backend-only service** (no UI exposed to users)
2. We build our own **simple, recipe-focused UI** in Next.js
3. Our UI talks to Activepieces via its **REST API** to create/run/manage workflows
4. Users never know Activepieces exists — they just see INGR's friendly interface

This is legal and free because the MIT-licensed core includes the REST API, workflow engine, and all 760+ connectors. The only features locked behind their paid "Enterprise" plan are white-labeling and their Embed SDK — which we don't need because we're building our own UI anyway.

### Important: Activepieces Enterprise Features We Do NOT Need

| Feature | Status | Why we don't need it |
|---------|--------|---------------------|
| Embed SDK | Paid (Enterprise) | We're building our own UI, not embedding theirs |
| White-label branding | Paid (Enterprise) | Users never see Activepieces' UI at all |
| SSO / SCIM | Paid (Enterprise) | We handle auth via Supabase |
| Audit logs | Paid (Enterprise) | We build our own activity logging |


---

## Part 4: Service Catalog (Launch Set)

These are the first services INGR will support. Chosen for: generous free tiers, good OAuth/API support, and high combinability.

### Tier 1 — Core Services (Must-Have for Launch)

| # | Service | What It Gives You Free | Why It's First |
|---|---------|----------------------|----------------|
| 1 | **Cloudflare** | DNS, CDN, SSL, Pages (hosting), Workers (serverless code), R2 (storage), DDoS protection | The single most valuable free tier on the internet. Foundation of multiple recipes. |
| 2 | **Supabase** | PostgreSQL database, auth, file storage, edge functions | Free database + auth for any project. 500MB storage, 50k MAU. |
| 3 | **Oracle Cloud** | 2 VMs (virtual servers), 24GB RAM, 200GB storage | Free compute powerful enough to run real applications. |
| 4 | **OpenRouter** | Access to free AI models (Llama, Mistral, etc.) | AI capability with zero cost. Users can also bring paid keys for GPT-4, Claude, etc. |
| 5 | **Vercel** | Web hosting, serverless functions, automatic HTTPS | Dead-simple free hosting for websites and web apps. |

### Tier 2 — Expansion Services (Post-Launch)

| # | Service | What It Gives You Free |
|---|---------|----------------------|
| 6 | **GitHub** | Code hosting, Pages (static hosting), Actions (automation) |
| 7 | **Netlify** | Static site hosting, forms, serverless functions |
| 8 | **Resend** | 3,000 emails/month free |
| 9 | **Upstash** | Serverless Redis + Kafka (message queuing) |
| 10 | **Turso** | SQLite database at the edge, 9GB free |
| 11 | **Neon** | Serverless PostgreSQL, generous free tier |
| 12 | **Backblaze B2** | 10GB free cloud storage |

### Tier 3 — Public APIs (Available Immediately, No Account Needed)

Sourced from the `public-apis` GitHub repo (483k stars, MIT license). Categories:
- Weather data (OpenWeatherMap, WeatherAPI)
- Currency exchange rates
- News aggregation
- IP geolocation
- QR code generation
- URL shortening
- Image placeholders
- Random data generators

These require no OAuth — INGR can call them directly on behalf of the user.

### Data Sources for the Catalog

| Source | License | How We Use It |
|--------|---------|---------------|
| [public-apis](https://github.com/public-apis/public-apis) | MIT | Parse and import the structured API list into our service directory |
| [free-for-dev](https://github.com/ripienaar/free-for-dev) | MIT | Parse and import the free-tier service catalog |
| Activepieces pieces library | MIT | 760+ existing connectors we inherit for free |


---

## Part 5: Launch Recipes

Each recipe is a pre-built combination of services that solves one specific problem. The user picks a recipe, connects the required services, and activates it. No configuration beyond the guided wizard.

### Recipe 1: Free Website Hosting
**Problem it solves:** "I want a website but don't want to pay for hosting."
**Services needed:** Cloudflare Pages
**What it does:**
- User connects their Cloudflare account
- User uploads their website files (HTML/CSS) or connects a GitHub repo
- INGR deploys it to Cloudflare Pages with automatic HTTPS
- User gets a free `*.pages.dev` URL (or connects their own domain)
**Difficulty to build:** Low — Cloudflare Pages API is well-documented

### Recipe 2: Free Uptime Monitor
**Problem it solves:** "I want to know if my website goes down."
**Services needed:** Oracle Cloud (for compute) + notification channel (email/Slack/Discord)
**What it does:**
- INGR provisions an Uptime Kuma instance on Oracle Cloud free tier
- User adds URLs to monitor
- Gets notified via email/Slack/Discord if anything goes down
- Public status page included
**Difficulty to build:** Medium — requires container management on Oracle Cloud

### Recipe 3: Free AI Chatbot Widget
**Problem it solves:** "I want an AI chat assistant on my website."
**Services needed:** OpenRouter (free AI models) + Cloudflare Workers
**What it does:**
- User connects OpenRouter (or brings their own OpenAI/Anthropic key)
- INGR deploys a chat widget script the user adds to their website
- Visitors can ask questions, AI responds using the chosen model
- User can customize the system prompt ("You are a helpful assistant for my bakery...")
**Difficulty to build:** Medium — needs a Worker deployment + widget JS

### Recipe 4: Free Contact Form Backend
**Problem it solves:** "My website has a contact form but I don't know how to make it actually send emails."
**Services needed:** Supabase (to store submissions) + Resend or email notification
**What it does:**
- User gets a form endpoint URL to point their HTML form at
- Submissions are stored in Supabase and emailed to the user
- Simple spam protection included
**Difficulty to build:** Low — straightforward API endpoint

### Recipe 5: Free Scheduled Database Backups
**Problem it solves:** "I have a database but I'm scared of losing my data."
**Services needed:** Source database connection + Cloudflare R2 (storage)
**What it does:**
- User connects their database (Supabase, Neon, or Turso)
- INGR runs an automated daily backup to Cloudflare R2
- User can download or restore from any backup
**Difficulty to build:** Medium — needs cron scheduling + database dump logic

### Future Recipes (Post-Launch Ideas)
- Free email newsletter (Resend + Supabase for subscriber list)
- Free link-in-bio page (Cloudflare Pages + template)
- Free file sharing / transfer (R2 + temporary links)
- Free cron job runner (scheduled tasks on Oracle Cloud)
- Free API endpoint (Supabase Edge Functions or Cloudflare Workers)
- Free analytics dashboard (self-hosted Plausible or Umami on Oracle)


---

## Part 6: Business Model

### Pricing Strategy

| Plan | Price | What You Get |
|------|-------|-------------|
| **Free** | $0/month | 2 active recipes, 3 connected services, community support, INGR branding on outputs |
| **Pro** | $7/month | Unlimited recipes, unlimited connected services, priority support, no INGR branding, advanced recipes |
| **Team** (future) | $15/month | Everything in Pro + 5 team members, shared recipes, team dashboard |

**Why $7/month for Pro:**
- Below the psychological $10 barrier
- Above $5 (which feels "too cheap to be good")
- Comparable to: Zapier Starter ($19.99 — we're 3x cheaper), IFTTT Pro ($3.49 — but far less capable)
- Positioned as "less than a Netflix subscription" for business infrastructure

### Revenue Model
- Primary: monthly subscriptions via Stripe
- Secondary (future): marketplace commission on premium recipe templates
- Tertiary (future): affiliate links to paid tiers of connected services (e.g., if a user upgrades from Cloudflare free to paid, we could earn a referral fee)

### Key Insight: Selling Convenience, Not Free Stuff
The free tier gets people in the door. The paid tier sells:
- **Time savings** (we configured everything, you didn't have to learn)
- **Reliability** (we monitor and maintain your setups)
- **Combinations** (individual free services are useful; combined, they're powerful)
- **Support** (when something breaks, you have someone to ask)


---

## Part 7: Build Phases

### Phase 0: Foundation (Week 1)
**Goal:** Get the engine running. See it work. Understand what we're building on.

**Steps:**
1. Install Docker on the development machine
2. Run Activepieces locally via `docker compose up`
3. Explore the Activepieces UI — create a test workflow, connect a test service
4. Test the Activepieces REST API — create a workflow via API call (without using the UI)
5. Confirm we can run Activepieces in headless mode (API only)
6. Document which existing "pieces" (connectors) are useful for our launch services

**Accounts needed:** None yet
**Deliverable:** A running Activepieces instance on localhost, with confirmed API access
**Success criteria:** Can create and run a workflow entirely via API calls

---

### Phase 1: Website Shell (Week 2-3)
**Goal:** A working website where people can sign up, log in, and see a dashboard.

**Steps:**
1. Initialize Next.js project with Supabase auth template: `npx create-next-app -e with-supabase`
2. Set up Supabase project (free tier) — database + auth
3. Build the landing page:
   - Hero section explaining INGR in plain English
   - "What you can do" section showing recipe cards
   - Pricing section (Free vs Pro)
   - Sign-up CTA
4. Build the auth flow:
   - Sign up with Google OAuth (one-click)
   - Sign up with email/password (fallback)
   - Login page
   - Password reset
5. Build the dashboard shell:
   - "Welcome, [name]" header
   - "Your Recipes" section (empty state with suggestions)
   - "Connected Services" section (empty state)
   - Settings / account page
6. Set up Crisp chat widget on the dashboard

**Accounts needed:** Supabase (free tier), Crisp (free tier)
**Deliverable:** Live local website with working auth. User can sign up, log in, see a dashboard.
**Success criteria:** End-to-end sign-up and login works. Dashboard loads. Chat widget appears.

---

### Phase 2: Connect-Your-Service Flow (Week 4-5)
**Goal:** Users can connect external services to INGR with the Cline-style one-click experience.

**Steps:**
1. Design the "Connect a Service" UI component:
   - Service card with logo, name, description of what it gives you free
   - "Connect" button → OAuth popup or guided API key entry
   - "Get a Free Account" link → opens service signup in new tab
   - Green checkmark when connected
2. Implement Cloudflare OAuth connection
3. Implement Supabase connection (API key based)
4. Implement OpenRouter OAuth connection (following the Cline pattern exactly)
5. Implement Oracle Cloud connection (API key based — Oracle doesn't have a simple OAuth)
6. Build the "Connected Services" dashboard page showing all connections with status
7. Store credentials securely using Activepieces' credential system (via its API)
8. Build credential refresh logic (auto-refresh expired OAuth tokens)

**Accounts needed:** User needs Cloudflare + OpenRouter accounts for testing
**Deliverable:** User can connect Cloudflare and OpenRouter to INGR in under 60 seconds each
**Success criteria:** OAuth flow works end-to-end. Tokens are stored. Credentials refresh automatically.

---

### Phase 3: First Recipe — Free Website Hosting (Week 6-7)
**Goal:** A user can activate the "Free Website Hosting" recipe and get a live website.

**Steps:**
1. Build the recipe wizard UI:
   - Step 1: "Connect Cloudflare" (or skip if already connected)
   - Step 2: "Upload your website files" (drag-and-drop) or "Connect your GitHub repo"
   - Step 3: "Choose your web address" (*.pages.dev or custom domain)
   - Step 4: "Activate" → deploys to Cloudflare Pages
2. Build the Activepieces workflow that handles deployment:
   - Trigger: recipe activation via INGR API
   - Action: deploy files to Cloudflare Pages via Cloudflare API
   - Action: configure custom domain (if provided)
   - Action: notify user with their live URL
3. Build the recipe status page:
   - Shows "Active" / "Deploying" / "Error" status
   - Shows the live URL
   - "Update Website" button (re-deploy with new files)
   - "Deactivate" button
4. Test end-to-end: sign up → connect Cloudflare → activate recipe → see live website

**Accounts needed:** Cloudflare account (for testing)
**Deliverable:** Working recipe that deploys a website to Cloudflare Pages
**Success criteria:** Non-technical tester can go from zero to live website in under 5 minutes

---

### Phase 4: Second Recipe — Free Uptime Monitor (Week 8-9)
**Goal:** A user can activate uptime monitoring without knowing what Docker or a server is.

**Steps:**
1. Build the recipe wizard:
   - Step 1: "What URLs do you want to monitor?" (text input for URLs)
   - Step 2: "Where should we send alerts?" (email / Slack / Discord)
   - Step 3: "Activate"
2. Build the backend provisioning:
   - Spin up an Uptime Kuma Docker container on Oracle Cloud
   - Configure it with the user's URLs and notification settings via Uptime Kuma API
   - Assign a subdomain (e.g., `username-monitor.ingr.app`)
3. Build the recipe status page:
   - Shows uptime/downtime for each monitored URL
   - "Add URL" / "Remove URL" buttons
   - Link to their public status page
   - "Deactivate" button
4. Implement container lifecycle management:
   - Pause container when recipe is deactivated
   - Resume when reactivated
   - Delete after 14-day grace period on cancellation

**Accounts needed:** Oracle Cloud (free tier)
**Deliverable:** Working uptime monitoring recipe
**Success criteria:** User can monitor a website and get alerts within 5 minutes of activation


---

### Phase 5: Billing Integration (Week 10)
**Goal:** Free and paid tiers are enforced. Paying users get more. Stripe handles money.

**Steps:**
1. Set up Stripe account and products:
   - Product: "INGR Pro" — $7/month recurring
   - Free tier: no Stripe involvement (just platform limits)
2. Build the upgrade flow:
   - "Upgrade to Pro" button on dashboard
   - Stripe Checkout Session (hosted payment page — we don't handle card numbers)
   - Webhook listener: when Stripe confirms payment, unlock Pro features in Supabase
3. Implement plan limits:
   - Free: 2 active recipes, 3 connected services
   - Pro: unlimited
   - Enforce in API middleware (check user's plan before activating recipes)
4. Build the billing settings page:
   - Current plan display
   - "Manage Subscription" link → Stripe Customer Portal (handles upgrades, downgrades, cancellation)
   - Invoice history
5. Implement cancellation flow:
   - User cancels via Stripe Portal
   - Webhook notifies INGR
   - Active recipes are paused (not deleted)
   - 14-day grace period countdown starts
   - After 14 days: recipes are deactivated, data is deleted
   - User gets email warnings at: cancellation, 7 days remaining, 1 day remaining

**Accounts needed:** Stripe (test mode first, then live)
**Deliverable:** Working payment flow with plan enforcement
**Success criteria:** Can upgrade to Pro, activate unlimited recipes, downgrade, see grace period work

---

### Phase 6: Production Deployment (Week 11-12)
**Goal:** INGR is live on the real internet with a real domain.

**Steps:**
1. Purchase domain (placeholder: `ingr.app` or `getingr.com` — human picks and buys)
2. Set up Cloudflare for the domain:
   - DNS records pointing to Oracle Cloud
   - SSL certificate (automatic via Cloudflare)
   - Wildcard subdomain for customer instances (`*.ingr.app`)
3. Set up Oracle Cloud free-tier instance:
   - Provision ARM VM (4 OCPU, 24GB RAM — free forever)
   - Install Docker and Docker Compose
   - Deploy INGR application stack (Next.js + Activepieces + PostgreSQL + Redis)
   - Configure firewall rules
4. Set up deployment pipeline:
   - GitHub repo for INGR codebase
   - GitHub Actions for CI/CD (test on push, deploy on merge to main)
   - Zero-downtime deployment strategy
5. Set up monitoring:
   - Use our own Uptime Kuma recipe to monitor INGR itself
   - Error tracking (Sentry free tier — 5k events/month)
   - Basic logging
6. Set up automated backups:
   - Daily database backup to Cloudflare R2
   - Backup verification (automated restore test weekly)
7. SSL and security hardening:
   - Force HTTPS everywhere
   - Rate limiting on auth endpoints
   - CORS configuration
   - Content Security Policy headers

**Accounts needed:** Domain registrar, Oracle Cloud, GitHub
**Deliverable:** INGR accessible at its real domain, with SSL, monitoring, and backups
**Success criteria:** Site loads from real domain. Auth works. Recipes work. Backups run.

---

### Phase 7: Polish and Testing (Week 13-14)
**Goal:** Make it feel professional. Find and fix bugs before real users see it.

**Steps:**
1. UI polish:
   - Loading states and skeleton screens
   - Error messages in plain English (never show raw error codes to users)
   - Empty states with helpful guidance ("You haven't connected any services yet. Here's how:")
   - Mobile responsiveness (dashboard must work on phones)
   - Dark mode (optional but nice)
2. Onboarding flow:
   - First-login wizard: "What do you want to do?" → suggest relevant recipes
   - Tooltips on first use of each feature
   - "Getting Started" checklist in the dashboard
3. Email notifications:
   - Welcome email after signup
   - Recipe activation confirmation
   - Weekly status digest (optional)
   - Cancellation warnings
4. Testing round:
   - Founder tests every flow end-to-end
   - 3-5 friends/contacts test as beta users
   - Document every bug and UX friction point
   - Fix critical issues before launch
5. Legal basics:
   - Terms of Service page
   - Privacy Policy page
   - Cookie consent (if needed based on jurisdiction)

**Accounts needed:** Resend (for transactional emails, free tier)
**Deliverable:** Polished, tested product ready for public launch
**Success criteria:** 5 beta users can complete the full flow without asking for help

---

### Phase 8: Launch (Week 15)
**Goal:** INGR is publicly available and people can find it.

**Steps:**
1. Launch checklist:
   - All recipes working end-to-end
   - Billing working in Stripe live mode
   - Support chat active with phone notifications
   - Monitoring and backups confirmed
   - Landing page SEO-optimized
2. Launch channels:
   - Product Hunt launch
   - Reddit posts (r/selfhosted, r/webdev, r/smallbusiness, r/SideProject)
   - Hacker News "Show HN" post
   - Twitter/X announcement
   - Indie Hackers community
3. Post-launch monitoring:
   - Watch error rates
   - Watch support chat volume
   - Monitor server resource usage
   - Watch Stripe for successful payments
4. Iterate based on feedback

**Deliverable:** Public launch with initial user acquisition
**Success criteria:** First 10 sign-ups. First paid customer.


---

## Part 8: Post-Launch Growth Phases

### Phase 9: More Recipes (Month 2-3)
- AI Chatbot Widget recipe
- Contact Form Backend recipe
- Scheduled Backups recipe
- Email Newsletter recipe
- Expand service catalog (Tier 2 services)

### Phase 10: User-Created Recipes (Month 4-6)
- Simplified recipe builder (NOT a node canvas — more like a step-by-step wizard for power users)
- Recipe templates library
- Community recipe sharing (users can publish recipes for others to use)
- Recipe marketplace (premium recipes, INGR takes a small commission)

### Phase 11: Team Features (Month 6+)
- Team accounts with multiple members
- Shared connected services within a team
- Role-based access (admin, member, viewer)
- Team billing

### Phase 12: Platform Expansion (Month 9+)
- Mobile app (React Native) for monitoring recipes on the go
- API access for developers who want to integrate INGR with their own tools
- Partner integrations (services reach out to be featured on INGR)
- International expansion (multi-language support)

---

## Part 9: Accounts & Credentials Timeline

Only create accounts when you actually need them. Here is when each one is needed:

| Account | When Needed | Phase | Cost |
|---------|-------------|-------|------|
| **Supabase** | Phase 1 (Website Shell) | Week 2 | Free tier |
| **Crisp** | Phase 1 (Website Shell) | Week 2 | Free tier |
| **Cloudflare** | Phase 2 (Connect Services) | Week 4 | Free tier |
| **OpenRouter** | Phase 2 (Connect Services) | Week 4 | Free tier |
| **Oracle Cloud** | Phase 4 (Uptime Monitor) | Week 8 | Always Free tier |
| **Stripe** | Phase 5 (Billing) | Week 10 | Free (2.9% + 30c per transaction) |
| **GitHub** | Phase 6 (Deployment) | Week 11 | Free tier |
| **Domain registrar** | Phase 6 (Deployment) | Week 11 | ~$10-15/year |
| **Resend** | Phase 7 (Polish) | Week 13 | Free tier (3k emails/month) |
| **Sentry** | Phase 6 (Deployment) | Week 11 | Free tier (5k events/month) |

**Total cost to launch: ~$10-15** (just the domain name). Everything else is free tier.

---

## Part 10: Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Free tier gets removed/reduced** (e.g., Oracle kills Always Free) | Medium | High | Monitor announcements. Have backup providers identified. Don't depend on a single provider for critical infrastructure. |
| **Activepieces changes their license** | Low | High | We fork at current MIT version. Our fork remains MIT forever regardless of upstream changes. |
| **User credentials get leaked** | Low | Critical | Never store raw credentials in our database. Use Activepieces' credential system (encrypted at rest). Regular security audits. |
| **Can't scale on free tier** | High (if successful) | Medium | This is a GOOD problem. If we outgrow free tiers, revenue from paid users should cover infrastructure costs. Plan migration path to paid tiers early. |
| **Users abuse free tier** (crypto mining, spam, etc.) | Medium | Medium | Rate limiting. Resource caps per user. Abuse detection. Terms of Service with clear acceptable use policy. |
| **AI agents make INGR obsolete** | Low-Medium | High | Our moat is simplicity for non-technical users. AI agents still require technical knowledge to operate. As long as non-technical users exist, INGR has a market. |
| **Competitor launches similar product** | Medium | Medium | First-mover advantage. Focus on UX quality. Build community. Recipes and connected-service ecosystem create switching costs. |

---

## Part 11: Project Rules (Repeated from PROJECT_RULES.md for completeness)

1. **Reuse First, Build Second** — search for existing open-source solutions before writing custom code.
2. **Explain Technical Decisions in Plain Language** — the founder is not a coder.
3. **Ask Before Spending or Breaking** — never spend money, delete data, or make irreversible choices without asking.
4. **Small Steps, Frequent Check-ins** — work in reviewable milestones. Summarize after each one.

### Additional Rules for AI Builders

5. **Read this plan before starting any work.** If something contradicts this plan, flag it — don't silently deviate.
6. **The UX principles in Part 2 override technical convenience.** If a technically simpler solution produces a worse user experience, choose the better UX.
7. **Test from the user's perspective.** After building a feature, mentally walk through it as a non-technical person. If you'd need to Google something to understand it, simplify.
8. **License check before adding ANY dependency.** MIT and Apache 2.0 are safe. Everything else gets flagged.
9. **Reference existing project files.** Before creating something new, check if it already exists:
   - `PROJECT_RULES.md` — standing rules
   - `RESEARCH_REPORT.md` — open-source landscape research
   - `MASTER_PLAN.md` — this file (the project bible)

---

## Part 12: Glossary (for the founder and for AI builders to use in UI copy)

| Term | What it means in plain English |
|------|-------------------------------|
| **API** | A way for two pieces of software to talk to each other. Like a waiter taking your order to the kitchen. |
| **API key** | A secret password that lets one service access another on your behalf. |
| **OAuth** | A secure way to connect two services without sharing your password. You click "Authorize" and they exchange access behind the scenes. |
| **Container (Docker)** | A self-contained package of software that runs the same way everywhere. Like a shipping container — whatever's inside is isolated and portable. |
| **DNS** | The internet's phone book. Translates human-readable addresses (like google.com) into computer addresses. |
| **CDN** | A network of servers around the world that stores copies of your content close to your visitors, making it load faster. |
| **SSL / HTTPS** | The padlock in your browser. Means the connection between your browser and the website is encrypted. |
| **Serverless** | Code that runs on someone else's servers without you having to manage those servers. You just write the code, they handle everything else. |
| **Webhook** | An automatic notification sent from one service to another when something happens. Like a doorbell — "something just happened, come look." |
| **CI/CD** | Continuous Integration / Continuous Deployment. Automatic testing and publishing of code changes. Push a button, your updates go live. |
| **Free tier** | A permanently free usage level of a paid service. Not a trial — it stays free forever within certain limits. |
| **Recipe (INGR-specific)** | A pre-built combination of services that solves a specific problem. Like a cooking recipe — follow the steps, get a result. |
| **Piece (Activepieces-specific)** | A connector plugin that lets Activepieces talk to a specific service (e.g., "the Cloudflare piece" lets it manage Cloudflare). |
| **Headless** | Running software without its visual interface. We use the engine behind the scenes but show users our own simpler interface. |
| **Row Level Security (RLS)** | A database rule that says "User A can only see User A's data, never User B's." Built into Supabase. |

---

## Part 13: File Structure (Expected)

```
INGR/
├── PROJECT_RULES.md          # Standing rules (never delete)
├── RESEARCH_REPORT.md        # Open-source landscape research
├── MASTER_PLAN.md            # This file — the project bible
├── app/                      # Next.js application
│   ├── (auth)/               # Login, signup, password reset pages
│   ├── (marketing)/          # Landing page, pricing, about
│   ├── (dashboard)/          # Protected dashboard pages
│   │   ├── recipes/          # Recipe management
│   │   ├── services/         # Connected services management
│   │   ├── settings/         # Account settings, billing
│   │   └── page.tsx          # Dashboard home
│   ├── api/                  # API routes (backend logic)
│   │   ├── recipes/          # Recipe CRUD + activation
│   │   ├── services/         # Service connection management
│   │   ├── billing/          # Stripe webhooks
│   │   └── activepieces/     # Proxy to Activepieces API
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Landing page
├── components/               # Reusable UI components
│   ├── ui/                   # Base UI components (buttons, cards, inputs)
│   ├── recipes/              # Recipe-specific components
│   ├── services/             # Service connection components
│   └── dashboard/            # Dashboard layout components
├── lib/                      # Shared utilities
│   ├── supabase/             # Supabase client setup
│   ├── activepieces/         # Activepieces API client
│   ├── stripe/               # Stripe utilities
│   └── utils/                # General utilities
├── docker/                   # Docker configuration
│   ├── docker-compose.yml    # Full stack (Activepieces + deps)
│   └── Dockerfile            # INGR app container
├── supabase/                 # Supabase configuration
│   ├── migrations/           # Database schema migrations
│   └── seed.sql              # Initial data (recipes, services)
└── public/                   # Static assets (logos, images)
```

---

*This is a living document. Update it as decisions are made and phases are completed.*

*End of INGR Master Plan.*

