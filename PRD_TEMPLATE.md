# [Project Name] — Product Requirements Document (PRD)

> **Document Status:** `Draft` | `In Review` | `Approved` | `Superseded`  
> **Target Launch Date:** `YYYY-MM-DD`  
> **Project Code / Monorepo App Name:** `[e.g., JR-OPS-042 / apps/admin/internal-portal]`  
> **Owning Department:** `[e.g., Admin / Logistics / Production / Inventory / Artisan Development / IT]`  
> **Executive Sponsor:** `[Name, Title]`  
> **Project Lead / Product Owner:** `[Name, Title]`  
> **Operational / Technical Lead:** `[Name, Title]`  
> **DB Module Name:** `[e.g., journeys / feedback / team-members / inventory]` *(must match `db/<module>/`)*  
> **Depends On (DB / Apps / Depts):** `[e.g., team-members (employees, departments), feedback]`  
> **Project Classification:**  
> - [ ] **Track A: Digital / Software** *(Next.js App Router, monorepo, Supabase, Edge Functions)*  
> - [ ] **Track B: Physical / Operational** *(weaving center setup, supply chain workflow, logistics route, SOP)*  
> - [ ] **Track C: Hybrid** *(physical operational workflow paired with dedicated digital system)*  
>
> **Governing references (do not diverge):** [`AGENTS.md`](./AGENTS.md) · `db/MIGRATIONS.md` · Module Tracker (`architecture.md` when present) · this template

---

## 0. How to use this template (Jaipur Rugs)

1. Duplicate → `apps/<app>/PRD.md` (or `docs/prds/<project-code>.md` if not yet an app).
2. Fill every `[...]` placeholder. Empty ROI numbers or empty test gates = PRD is not ready for approval.
3. Track A/C: Section 5.1 + Section 8–10 are binding before any migration or frontend scaffolding.
4. Track B/C: Section 5.2 + bilingual SOP attachments are binding before field rollout.
5. Obtain Section 12 sign-off **before** writing production code or CapEx purchases.
6. Planning ≠ execution: do not scaffold apps or run setup commands as a side effect of filling this PRD.

---

## 1. Executive Summary & Strategic Vision

### 1.1 The "Why" & Organizational Alignment
*Explain why Jaipur Rugs is undertaking this initiative. Tie to craftsmanship ↔ global market, social empowerment, operational excellence, lean manufacturing, sustainability.*

> **Vision Statement:**  
> *[2–3 sentences: future state once this project is live.]*

### 1.2 Core Project Thesis
By solving **[specific operational friction / system gap]**, we will enable **[target stakeholders]** to **[core capability]**, resulting in **[tangible financial / time / resource recovery]** without sacrificing craftsmanship or operational integrity.

### 1.3 Key Business Objectives (OKRs)
| Objective | Key Result / Target Metric | Measurement Baseline | Target Date |
|:---|:---|:---|:---|
| **O1:** `[...]` | `[...]` | Current: `[...]` | `YYYY-MM-DD` |
| **O2:** `[...]` | `[...]` | Current: `[...]` | `YYYY-MM-DD` |
| **O3:** `[...]` | `[...]` | Current: `[...]` | `YYYY-MM-DD` |

---

## 2. Problem Statement & Root Cause Analysis

### 2.1 Current State ("As-Is")
- **Current Workflow:** `[Step 1 → Step 2 → Step 3...]`
- **Friction Points:** `[Where work stalls, drops, or generates errors]`
- **Data Blindspots:** `[What leadership / supervisors cannot see in real time]`
- **Tools in use today:** `[WhatsApp / Excel / paper / legacy system — name them]`

### 2.2 Impacted Stakeholders
| Stakeholder Group | Role in Jaipur Rugs Ecosystem | How Current Problem Affects Them |
|:---|:---|:---|
| **Artisans / Weavers** | Rural manufacturing backbone | `[...]` |
| **Field / Floor Managers** | Hub coordinators / supervisors | `[...]` |
| **Operations / Logistics** | Fleet, warehouse, inventory | `[...]` |
| **Corporate / Leadership** | Strategy, finance, executives | `[...]` |
| **External / Guests / Clients** | Buyers, showroom, partners | `[...]` |
| **IT / Platform** | Monorepo, Hub, shared DB | `[...]` |

### 2.3 Root Cause Analysis (5 Whys)
1. **Symptom:** `[...]`
2. **Why?** `[...]`
3. **Why?** `[...]`
4. **Why?** `[...]`
5. **Root Cause:** `[...]`

### 2.4 Cost of Inaction (COI) — next 6–12 months
- **Financial Leakage:** `[₹ ...]`
- **Operational Degradation:** `[...]`
- **Brand / Human Impact:** `[...]`

---

## 3. Resource Reclamation & Financial ROI Engine *(required)*

*Every Jaipur Rugs project must justify existence by recovering, generating, or optimizing capital, human hours, or operational resources.*

### 3.1 Direct Financial & Monetary Impact
| Financial Category | Current Annual Cost | Projected Annual Post-Launch | Net Annual Savings / Value | Rationale & Formula |
|:---|:---|:---|:---|:---|
| **OpEx** | `₹ [...]` | `₹ [...]` | **`₹ [...]`** | `[...]` |
| **CapEx avoided / deferred** | `₹ [...]` | `₹ [...]` | **`₹ [...]`** | `[...]` |
| **Rework / Scrap / Loss** | `₹ [...]` | `₹ [...]` | **`₹ [...]`** | `[...]` |
| **Revenue Enablement** | `₹ [...]` | `₹ [...]` | **`₹ [...]`** | `[...]` |
| **TOTAL ANNUAL NET VALUE** | — | — | **`₹ [...]`** | **Payback: `[X]` months** |

### 3.2 Man-Hour & FTE Redistribution
| Department / Role | Manual Task Eliminated | Hrs Saved / Week / Person | Headcount | Monthly Hours Reclaimed | Where Time Is Reinvested |
|:---|:---|:---:|:---:|:---:|:---|
| `[...]` | `[...]` | `[...]` | `[...]` | `[...]` | `[...]` |
| **TOTAL** | — | — | — | **`[X] hrs/mo`** | **`≈ Y FTE reclaimed`** |

### 3.3 Process Velocity & Cycle Time
| Process Step | Baseline | Target | % Reduction | Error Rate Before → Target |
|:---|:---|:---|:---|:---|
| `[...]` | `[...]` | `[...]` | `[...]` | `[...]` |

### 3.4 Physical & Environmental Resource Optimization
- **Material Conservation:** `[...]`
- **Fleet / Fuel:** `[...]`
- **Asset Lifespan:** `[...]`

---

## 4. Solution Architecture & Scope Boundaries

### 4.1 In-Scope vs Out-of-Scope
| In-Scope (this project) | Explicitly Out-of-Scope |
|:---|:---|
| ✅ `[Capability 1]` | ❌ `[Deferred / prohibited]` |
| ✅ `[Capability 2]` | ❌ `[...]` |
| ✅ `[Capability 3]` | ❌ `[...]` |

### 4.2 Core Deliverables & Key Capabilities
1. **Capability 1:** `[...]`
2. **Capability 2:** `[...]`
3. **Capability 3:** `[...]`

### 4.3 End-to-End User / Operational Journey
1. **Trigger / Entry:** `[e.g., manager opens Hub launcher → department tile]`
2. **AuthZ check:** `[role / department / grant required]`
3. **Processing:** `[writes via which Edge Function(s)]`
4. **Execution:** `[notifications, physical handoffs, etc.]`
5. **Resolution & Feedback:** `[completion, audit trail, metrics]`

### 4.4 Monorepo Placement (Track A / C)
| Artifact | Path / Name | Notes |
|:---|:---|:---|
| Frontend app | `apps/[...]` | One Vercel project per app (or on-prem exception) |
| DB module | `db/[module]/` | ERD `.mmd` + numbered migrations |
| Write APIs | `supabase/functions/<module>-<action>` | Called only via `packages/db-management-client` |
| Shared packages touched | `packages/[...]` | Justify each change as multi-app need |
| Types regen | `packages/supabase-client` | Mandatory after schema lands |
| Hosting | `[Vercel subdomain / on-prem]` | e.g. `inventory.jaipurrugs.com` |

### 4.5 Cross-Department & Cross-Module Dependencies
*Jaipur Rugs has dense inter-department dependencies. List them explicitly — do not assume isolation.*

| Dependency | Type (DB FK / Process / Org / App) | Owner | Blocking? | Status |
|:---|:---|:---|:---:|:---|
| `[e.g., employees.id]` | DB | Hub / team-members | Yes | `[Exists / Planned]` |
| `[e.g., Admin grant on dept]` | AuthZ | Hub | Yes | `[...]` |
| `[e.g., Feedback moderation flow]` | Process + DB | Admin | No | `[...]` |

---

## 5. Governance & Compliance Gateways

### 5.1 Track A & C — Digital Standards *(from `AGENTS.md`)*
- [ ] **One shared Supabase project** only (`matnispbauvvlnbsuzxq` — verify live ID before migrating; never trust name alone).
- [ ] **Schema-first:** plain-language entities → Mermaid ERD in `db/<module>/` → review → SQL.
- [ ] **Conventions:** `uuid id` PKs; FKs `<entity>_id`; `timestamptz created_at` / `updated_at`; Postgres `enum` for statuses (no free-text status).
- [ ] **RLS designed with schema** (not after). Helpers in **`private`** schema only (never `public` RPC-exposed helpers).
- [ ] **No service-role key** in any app (including Hub). Frontend client is **read-only** (`packages/supabase-client`).
- [ ] **Writes only** via Edge Functions + `packages/db-management-client`.
- [ ] **Fixed stack:** Next.js App Router · TypeScript · Hero UI · Bklit · Node.js · pnpm + Turborepo · Vercel (or approved on-prem). No second UI kit / chart lib / ORM / DB engine.
- [ ] **Session:** `packages/auth`, cookie domain `.jaipurrugs.com`. App still re-checks role/dept on load; unauthorized → Hub launcher.
- [ ] **Migration ledger:** applied + advisors clean + logged in `db/MIGRATIONS.md`.
- [ ] **Types regenerated** and committed after schema change.
- [ ] **Module Tracker** updated (`architecture.md`) when present.
- [ ] **Storage:** self-hosted S3 by default. Supabase Storage only with an explicit recorded override (same bar as driver-photos / employee-avatars).
- [ ] **Shared package changes** treated as org-wide public API; fan-out checked before merge.

### 5.2 Track B & C — Operational / Physical Standards
- [ ] Bilingual SOP (Hindi + English) with visuals for field staff
- [ ] Cross-department SLA / handoff sign-off
- [ ] Artisan welfare, safety, fair-pay impact reviewed
- [ ] Training & enablement plan before cutover
- [ ] Rollback / offline / power-failure contingency SOP for rural centers

---

## 6. Fixed Tech Stack & Non-Negotiables *(copy into every Track A/C PRD)*

| Layer | Choice | Do not substitute with |
|:---|:---|:---|
| Frontend | Next.js (App Router) | Pages Router, separate SPA frameworks |
| Language | TypeScript (apps + packages) | Untyped JS “just for this module” |
| Runtime | Node.js | Alternate runtimes without escalation |
| DB + Auth | One Supabase project (shared) | Per-app DBs / second auth provider |
| Writes | Supabase Edge Functions + `db-management-client` | Direct client writes / service-role in apps |
| Reads | `packages/supabase-client` (read-only) | Ad-hoc clients |
| UI | Hero UI via `packages/ui-kit` | Second component library |
| Charts | Bklit via `packages/charts` | Second charting library |
| Tooling | pnpm workspaces + Turborepo | npm/yarn-only app islands |
| Hosting | Vercel (one project per app) | Silent hosting forks |
| Object storage | Self-hosted S3 | Supabase Storage (unless recorded override) |

**Do's (summary):** ERD + RLS before app code · regenerate types · run advisors · fold only genuinely shared UI into packages · design for legitimate cross-module joins · redirect unauthorized users to Hub.

**Don'ts (summary):** No per-module DB · no service-role in apps · no frontend before RLS · no `apps/team-members` (lives in Hub) · no per-app session forks · no free-text enums · no ad-hoc build-order reordering · no scaffolding during planning.

---

## 7. Domain Dictionaries & Controlled Vocabulary

*Org has multiple dictionaries across departments. Each PRD must pin the terms this project owns or consumes so agents and humans do not invent synonyms.*

### 7.1 Terms this project **owns** (source of truth)
| Term | Definition | Canonical field / enum | Synonyms **not** to use in UI/DB |
|:---|:---|:---|:---|
| `[e.g., Journey]` | `[...]` | `journeys` / `journey_status` | Trip, Ride (unless mapped) |
| `[...]` | `[...]` | `[...]` | `[...]` |

### 7.2 Terms this project **consumes** (owned elsewhere)
| Term | Owned by (module / dept) | How we reference it | Notes |
|:---|:---|:---|:---|
| `Employee` | team-members / Hub | `employees.id` | Never duplicate person tables |
| `Department` | team-members / Hub | `departments.id` | `[...]` |
| `[...]` | `[...]` | `[...]` | `[...]` |

### 7.3 Status / enum map
| Concept | Enum name | Allowed values | Transition rules |
|:---|:---|:---|:---|
| `[...]` | `[...]` | `[...]` | `[...]` |

---

## 8. Data Model Plan (Track A / C) — Section 3.1 of AGENTS.md

Complete **before** scaffolding `apps/<name>`.

1. **Entities & relationships (plain language):** `[...]`
2. **ERD:** `db/<module>/<module>-schema.mmd` (Mermaid `erDiagram`, Team Members style)
3. **Tables / enums / junctions:** `[list]`
4. **RLS matrix:**
   | Table | SELECT who | INSERT/UPDATE path | Row scope (dept / role / hierarchy) |
   |:---|:---|:---|:---|
   | `[...]` | `[...]` | Edge Fn `[...]` only | `[...]` |
5. **Advisor + MIGRATIONS.md + types regen:** planned owners / dates
6. **Frontend scaffolding gate:** only after schema + RLS + types settled

---

## 9. Best Practices Checklist (delivery)

### 9.1 Product / PM
- [ ] Problem, ROI, and scope signed before build
- [ ] Dictionaries locked (Section 7) so copy and schema stay aligned
- [ ] Dependencies named with owners; no silent assumptions across depts
- [ ] Acceptance criteria written as observable behaviors (Section 10)

### 9.2 Engineering (monorepo)
- [ ] App-specific UI stays in the app; only multi-app needs promote to `packages/*`
- [ ] Breaking shared-package changes communicated + fan-out verified
- [ ] Env vars per Vercel project; secrets never committed
- [ ] Unauthorized users redirected to Hub, not empty shells
- [ ] Offline / low-connectivity behavior decided for field-facing surfaces

### 9.3 Security
- [ ] RLS + private helpers verified
- [ ] No service-role leakage
- [ ] AuthZ re-checked on every app load
- [ ] PII / artisan / guest data minimization noted

### 9.4 Ops / rollout
- [ ] Seed / demo data plan (and cleanup after E2E)
- [ ] Training plan for operators (Hindi/English as needed)
- [ ] Rollback plan (feature flag, migration down strategy, or SOP fallback)

---

## 10. Testing Strategy & Definition of Done

*Typecheck/build alone is not enough. Internal Portal precedent: browser E2E against the live (or staging) stack caught RLS recursion and hydration bugs that `tsc` / `next build` missed.*

### 10.1 Test layers (required for Track A / C)
| Layer | What it covers | Tooling / approach | Owner | Gate |
|:---|:---|:---|:---|:---|
| **Static** | Types, lint | `tsc --noEmit`, lint | Eng | Must be clean |
| **Unit** | Pure logic, formatters, conflict helpers | Vitest/Jest (as adopted in repo) | Eng | Critical paths covered |
| **DB / SQL** | Constraints, EXCLUDE/GiST, triggers, RLS | Direct SQL + authenticated session queries | DB lead | Overlap/deny cases proven |
| **API / Edge** | Each `<module>-<action>` write path | Real HTTP invoke via `db-management-client` | Eng | Happy + 4xx/409 paths |
| **Integration** | App ↔ Edge ↔ DB with real auth | Staging / dedicated test project if available | Eng | Role matrix sampled |
| **E2E (browser)** | Full user journeys in real Chromium | Playwright (or equivalent) against running app | Eng + PM | Checklist below green |
| **Advisor** | Security + performance linters | Supabase advisors post-migration | DB lead | Findings resolved or waived in writing |
| **Regression** | Shared packages fan-out | Build/test dependent apps after package change | Eng | No silent breaks |

### 10.2 Mandatory E2E scenarios (customize per project)
Copy and extend; mark each Pass/Fail with date + evidence link.

| # | Scenario | Actor / Role | Steps (summary) | Expected | Status |
|:---:|:---|:---|:---|:---|:---|
| E1 | Unauthenticated access | Anonymous | Open app root | Redirect to login / Hub auth | `[ ]` |
| E2 | Unauthorized role | Authenticated, wrong dept/role | Open app | Redirect to Hub launcher; no empty UI | `[ ]` |
| E3 | Authorized happy path | Target role | Complete primary workflow end-to-end | Data persisted; UI reflects truth | `[ ]` |
| E4 | Write conflict / validation | Target role | Trigger domain conflict (e.g. double-book) | Clear error (e.g. 409); no partial write | `[ ]` |
| E5 | RLS isolation | Other dept / lesser role | Attempt read/write outside scope | Denied; no data leak | `[ ]` |
| E6 | Shared session SSO | User with Hub session | Land on app subdomain | Session works; AuthZ still re-checked | `[ ]` |
| E7 | Primary nav / no console errors | Target role | Visit every primary route | Renders; no page/console errors | `[ ]` |
| E8 | Cleanup | Tester | Delete test rows created | DB restored to agreed baseline | `[ ]` |

### 10.3 Acceptance Criteria (product)
*Observable, testable — not “system should be fast/nice.”*

| ID | Criterion | How verified |
|:---|:---|:---|
| AC1 | `[...]` | `[E2E # / metric / demo]` |
| AC2 | `[...]` | `[...]` |
| AC3 | `[...]` | `[...]` |

### 10.4 Definition of Done (ship gate)
- [ ] PRD Approved (Section 12)
- [ ] ERD reviewed; migrations applied; advisors clean; `db/MIGRATIONS.md` updated
- [ ] `packages/supabase-client` types regenerated & committed
- [ ] Edge Functions deployed (or explicitly deferred with owner/date)
- [ ] Static checks clean (`tsc`, lint as applicable)
- [ ] Unit + DB + API tests for critical paths green
- [ ] Browser E2E checklist (Section 10.2) green against real running app + real project (or approved staging)
- [ ] Unauthorized + RLS cases proven (not assumed)
- [ ] Test data cleaned up
- [ ] Module Tracker / README / UPDATE notes left for the next owner
- [ ] Training / SOP complete if Track B/C or field-facing

---

## 11. Milestone-Driven Execution Roadmap

```
Phase 0: Discovery & Schema/SOP  →  Phase 1: MVP / Pilot  →  Phase 2: E2E Gate  →  Phase 3: Production Cutover
```

| Phase | Milestone | Key Deliverables | Target Date | Owner | Status |
|:---|:---|:---|:---:|:---:|:---:|
| **0** | Discovery & alignment | Approved PRD, ERD or SOP, dictionaries | `YYYY-MM-DD` | `[...]` | Pending |
| **1** | MVP / pilot | Staging build or single-site pilot | `YYYY-MM-DD` | `[...]` | Pending |
| **2** | Verification gate | Advisors clean + browser E2E green | `YYYY-MM-DD` | `[...]` | Pending |
| **3** | Production rollout | Live deploy / all hubs active | `YYYY-MM-DD` | `[...]` | Pending |

### 11.1 Key Dependencies & Constraints
- **D1:** `[e.g., migration N applied; types regenerated]`
- **D2:** `[e.g., hardware / training / budget]`
- **D3:** `[...]`

### 11.2 Risk Register
| Risk | Severity | Likelihood | Impact | Mitigation |
|:---|:---:|:---:|:---|:---|
| `[...]` | H/M/L | H/M/L | `[...]` | `[...]` |

---

## 12. Stakeholder Sign-Off & Approvals

*Sign-off confirms: problem is accurate, ROI is sound, dictionaries are locked, governance gateways and test gates are binding.*

| Role | Name | Title / Department | Signature / Date | Status |
|:---|:---|:---|:---:|:---:|
| **Executive Sponsor** | `[...]` | `[...]` | `____________________` | Pending |
| **Product / Project Owner** | `[...]` | `[...]` | `____________________` | Pending |
| **Operations Lead** | `[...]` | `[...]` | `____________________` | Pending |
| **Technical Architect** *(Track A/C)* | `[...]` | Monorepo / Supabase | `____________________` | Pending |
| **Finance / ROI Auditor** | `[...]` | `[...]` | `____________________` | Pending |

---

## Appendix A — Quick links
- [`AGENTS.md`](./AGENTS.md) — execution law for the monorepo
- `db/MIGRATIONS.md` — applied migration ledger
- `db/<module>/*-schema.mmd` — ERD source of truth per module
- `packages/*` — shared contracts (treat as public API)
- Precedent: Internal Portal browser-verified E2E notes in `UPDATE.md`

## Appendix B — Open org-level items to inherit / resolve
- DB scoring matrix / Module Tracker in `architecture.md` (create when prioritizing next department module)
- Edge function deploy status for any functions this PRD depends on
- Any storage override must be recorded with date + rationale (not silent)
