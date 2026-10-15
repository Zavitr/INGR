# INGR Platform Test Infrastructure & Multi-Tier E2E Architecture

**Author:** E2E Test Writer (`test_writer_m3`)  
**Milestone:** Milestone 3 (E2E Testing Track)  
**Date:** 2026-10-03  
**Status:** Operational  

---

## 1. Architectural Overview & Design Philosophy

The INGR test suite is designed as an **opaque-box end-to-end (E2E) testing framework** that validates both the **Headless Activepieces Orchestration Engine** (`/engine`) and the **Next.js Web Frontend & Dashboard** (`/web`) from the external client perspective.

### Core Testing Principles:
1. **Opaque-Box Verification**: The test suite treats internal modules as opaque implementations, interacting solely via exposed HTTP REST APIs, build tools, CLI interfaces, and standard web contracts.
2. **Deterministic Output Derivation**: Expected outputs for all assertions are derived strictly from authoritative system requirements (`ORIGINAL_REQUEST.md`, `MASTER_PLAN.md`, and `PROJECT.md`).
3. **Four-Tier Verification Model**:
   - **Tier 1 (Feature Coverage)**: Deep functional coverage with at least 5 isolated tests per feature across all 15 project features (75 tests).
   - **Tier 2 (Boundary & Corner Cases)**: Exhaustive boundary probes, authentication denials, malformed payloads, 404 routing, and adversarial jargon audits (12 tests).
   - **Tier 3 (Cross-Feature Combinations)**: Multi-system workflows verifying auth sessions, credential vaulting, API proxy mediation, and connector dependencies (6 tests).
   - **Tier 4 (Real-World Scenarios)**: Complete end-to-end user journeys walking from visitor landing page through onboarding, service connection via the Cline pattern, recipe creation, and account settings (4 scenarios).
4. **Data Isolation & Automatic Cleanup**: Every test creating state generates isolated identifiers and guarantees teardown through `deleteAppConnection`, ensuring idempotency and zero residue across test runs.

---

## 2. Directory Layout & Test Suite Hierarchy

```
/home/zavitr/Documents/INGR/
├── tests/
│   └── e2e/
│       ├── run_all.sh                 # Master executable shell test runner
│       ├── runner.mjs                 # Node.js test harness and structured reporter
│       ├── helpers/
│       │   ├── api_client.mjs         # HTTP client for Activepieces and Next.js APIs
│       │   ├── assertions.mjs         # Descriptive assertion helpers
│       │   └── test_context.mjs       # Environment configurations and test registry
│       ├── tier1_features/
│       │   ├── test_f1_docker.mjs     # F1: Docker Orchestration & Service Health (5 tests)
│       │   ├── test_f2_engine_api.mjs # F2: Headless Engine REST API (5 tests)
│       │   ├── test_f3_vault.mjs      # F3: Engine Admin Auth & Credential Vault (5 tests)
│       │   ├── test_f4_verify.mjs     # F4: Standalone Verification Script (5 tests)
│       │   ├── test_f5_hygiene.mjs    # F5: Engine Configuration Hygiene (5 tests)
│       │   ├── test_f6_build.mjs      # F6: Frontend Build & Typecheck (5 tests)
│       │   ├── test_f7_routes.mjs     # F7: Route Integrity & Link Repair (5 tests)
│       │   ├── test_f8_auth.mjs       # F8: Supabase Email/Password Auth (5 tests)
│       │   ├── test_f9_oauth.mjs      # F9: Supabase Google OAuth & Callback (5 tests)
│       │   ├── test_f10_landing.mjs   # F10: Plain-English Landing Page (5 tests)
│       │   ├── test_f11_dashboard.mjs # F11: Protected Dashboard Shell (5 tests)
│       │   ├── test_f12_recipes.mjs   # F12: Recipe Creation Route (5 tests)
│       │   ├── test_f13_crisp.mjs     # F13: Crisp Chat Widget Integration (5 tests)
│       │   ├── test_f14_styling.mjs   # F14: Responsive Styling & Layout (5 tests)
│       │   └── test_f15_infra.mjs     # F15: E2E Test Suite Infrastructure (5 tests)
│       ├── tier2_boundaries/
│       │   └── test_boundaries.mjs    # Tier 2: Boundary & Corner Cases (12 tests)
│       ├── tier3_combinations/
│       │   └── test_combinations.mjs  # Tier 3: Cross-Feature Combinations (6 tests)
│       └── tier4_scenarios/
│           └── test_scenarios.mjs     # Tier 4: Real-World Scenarios (4 scenarios)
├── TEST_INFRA.md                      # Test infrastructure architecture specification
└── TEST_READY.md                      # Test readiness declaration and execution instructions
```

---

## 3. Feature Coverage Matrix (F1 – F15)

| Feature ID | Feature Description | Test Suite File | Test Count | Test Case IDs |
|------------|---------------------|-----------------|------------|---------------|
| **F1** | Docker Orchestration & Health | `tier1_features/test_f1_docker.mjs` | 5 | F1-01 to F1-05 |
| **F2** | Headless Engine REST API | `tier1_features/test_f2_engine_api.mjs` | 5 | F2-01 to F2-05 |
| **F3** | Engine Admin Auth & Credential Vault | `tier1_features/test_f3_vault.mjs` | 5 | F3-01 to F3-05 |
| **F4** | Engine Standalone Verification Script | `tier1_features/test_f4_verify.mjs` | 5 | F4-01 to F4-05 |
| **F5** | Engine Configuration Hygiene | `tier1_features/test_f5_hygiene.mjs` | 5 | F5-01 to F5-05 |
| **F6** | Frontend Build & Typecheck Resolution | `tier1_features/test_f6_build.mjs` | 5 | F6-01 to F6-05 |
| **F7** | Route Integrity & Link Repair | `tier1_features/test_f7_routes.mjs` | 5 | F7-01 to F7-05 |
| **F8** | Supabase Email/Password Auth | `tier1_features/test_f8_auth.mjs` | 5 | F8-01 to F8-05 |
| **F9** | Supabase Google OAuth & Callback | `tier1_features/test_f9_oauth.mjs` | 5 | F9-01 to F9-05 |
| **F10** | Plain-English Landing Page | `tier1_features/test_f10_landing.mjs` | 5 | F10-01 to F10-05 |
| **F11** | Protected Dashboard Shell | `tier1_features/test_f11_dashboard.mjs` | 5 | F11-01 to F11-05 |
| **F12** | Recipe Creation Route | `tier1_features/test_f12_recipes.mjs` | 5 | F12-01 to F12-05 |
| **F13** | Crisp Chat Widget Integration | `tier1_features/test_f13_crisp.mjs` | 5 | F13-01 to F13-05 |
| **F14** | Responsive Styling & Layout | `tier1_features/test_f14_styling.mjs` | 5 | F14-01 to F14-05 |
| **F15** | E2E Test Suite & Infrastructure | `tier1_features/test_f15_infra.mjs` | 5 | F15-01 to F15-05 |
| **T2** | Boundary & Corner Cases | `tier2_boundaries/test_boundaries.mjs` | 12 | B01 to B12 |
| **T3** | Cross-Feature Combinations | `tier3_combinations/test_combinations.mjs` | 6 | C01 to C06 |
| **T4** | Real-World Application Scenarios | `tier4_scenarios/test_scenarios.mjs` | 4 | S01 to S04 |
| **Total** | **Comprehensive Full Suite** | **All Suites** | **97** | **97 / 97 Tests** |

---

## 4. Execution Guide & CLI Options

The runner script `/home/zavitr/Documents/INGR/tests/e2e/run_all.sh` provides flexible execution options:

### 1. Run Complete Test Suite (Default)
```bash
bash /home/zavitr/Documents/INGR/tests/e2e/run_all.sh
```
Runs all 97 tests across Tiers 1–4, outputs formatted progress with per-test timings, prints summary tables, and returns exit code 0 on all pass.

### 2. Run Specific Tier
```bash
# Tier 1 (Feature Coverage - 75 tests)
bash /home/zavitr/Documents/INGR/tests/e2e/run_all.sh --tier 1

# Tier 2 (Boundary & Corner Cases - 12 tests)
bash /home/zavitr/Documents/INGR/tests/e2e/run_all.sh --tier 2

# Tier 3 (Cross-Feature Combinations - 6 tests)
bash /home/zavitr/Documents/INGR/tests/e2e/run_all.sh --tier 3

# Tier 4 (Real-World Scenarios - 4 tests)
bash /home/zavitr/Documents/INGR/tests/e2e/run_all.sh --tier 4
```

### 3. Run Subsystem-Targeted Tests
```bash
# Engine Subsystem (F1 - F5: 25 tests)
bash /home/zavitr/Documents/INGR/tests/e2e/run_all.sh --engine

# Web Subsystem (F6 - F15: 50 tests)
bash /home/zavitr/Documents/INGR/tests/e2e/run_all.sh --web
```

### 4. Structured JSON Output
```bash
bash /home/zavitr/Documents/INGR/tests/e2e/run_all.sh --json
```

---

## 5. Environment & Dependencies

- **Node.js**: v22.22.3 (uses native `fetch`, native `fs`, and ES Module syntax).
- **Docker**: Activepieces, PostgreSQL 15, and Redis 7 containers running on host.
- **Environment Variables**:
  - `ACTIVEPIECES_API_URL`: Base URL for engine REST API (defaults to `http://localhost:8080`).
  - `AP_ADMIN_EMAIL`: Admin email for authentication (defaults to `admin@ingr.local`).
  - `AP_ADMIN_PASSWORD`: Admin password for authentication (defaults to `IngrAdminPassword2026!`).
