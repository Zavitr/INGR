# INGR — Project Rules (Permanent)

These rules apply to **every decision** made throughout the project. They are not suggestions — they are standing orders.

---

## Rule #1: Reuse First, Build Second

Before writing **any** code, component, or system from scratch:

1. **Search for existing open-source projects** that already do what we need, or something close to it.
2. **Search for existing libraries, modules, and packages** that handle the specific functionality.
3. **Evaluate** the best candidates by: license compatibility (MIT/Apache preferred), active maintenance, community size, and how well they fit our needs.
4. **Fork, extend, or integrate** the best existing solution into our platform.
5. **Only write custom code** if there is genuinely nothing suitable available — which should be rare.

This applies to everything: auth flows, workflow engines, UI components, API connectors, database layers, deployment tools, monitoring — all of it.

**Rationale:** We are a tiny team. Every line of code we write is a line we have to maintain. Leveraging battle-tested, community-maintained code lets us move faster and ship more reliably.

---

## Rule #2: Explain Technical Decisions in Plain Language

The founder is not a coder. Every technical decision must come with a one-liner explanation of *why* in plain English.

---

## Rule #3: Ask Before Spending or Breaking

- Never spend money without asking first.
- Never delete real data without asking first.
- Never make a hard-to-reverse architectural choice without asking first.

---

## Rule #4: Small Steps, Frequent Check-ins

Work in small, reviewable milestones. After each one, summarize what was done and what's next. Don't build for hours unsupervised.

---

*Last updated: 2026-09-26*
