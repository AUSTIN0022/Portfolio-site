# SmartFormFlow (SFF)
### A Multi-Tenant SaaS Platform for Event Registration, Dynamic Forms, Payments & Automated Communication

**Built by:** Austin Makasare (YSM Infosolutions)
**Role:** Full-stack engineer — architecture, backend systems, infrastructure, and product decisions
**Status:** Pre-launch → transitioning from single-client internal tool to multi-tenant SaaS
**Stack:** Node.js 20 · TypeScript 5 · Express 5 · Prisma 7 · PostgreSQL · BullMQ · Redis · Next.js · Docker

---

## 1. What It Is

SmartFormFlow is a "Google Forms Pro" for event organizers — a platform that lets businesses build dynamic, multi-step registration forms, collect payments, automatically issue certificates, message attendees over email/WhatsApp, and manage every attendee as a deduplicated contact across all their events.

It competes conceptually with **Typeform**, **Google Forms**, and **Jotform**, but differentiates itself with a set of integrations that those tools either don't offer or charge enterprise prices for:

- **Integrated payments** (Razorpay, including a bring-your-own-keys model — see §5)
- **Automated certificate generation** via a background job queue
- **WhatsApp + Email notifications** as first-class messaging channels
- **Global contact deduplication** — every form submission across every event resolves to one canonical contact record
- **Field-level drop-off analytics** — knowing not just *how many* people abandoned a form, but *where*

**Target market:** SMB event organizers, training institutes, and conference/workshop hosts in India and globally. Pricing is dual-currency (INR/USD) across three tiers: **Starter** (free), **Growth** (₹1,999/mo · $29/mo), and **Scale** (₹5,999/mo · $79/mo).

---

## 2. The Journey — Why & How This Was Built

SmartFormFlow didn't start as a SaaS product. It began as an **internal tool built for a single client** who needed to run paid online event registrations with certificate issuance. As that tool matured and proved itself in production, the decision was made to generalize it into a proper multi-tenant SaaS — which meant revisiting nearly every layer of the system:

1. **Single-tenant → multi-tenant migration.** Every table, every query, every service had to be audited and retrofitted with `organizationId` scoping. This is documented in detail in §6.
2. **Database infrastructure migration.** The project moved from a Neon serverless Postgres (WebSocket-based) setup to a **self-hosted PostgreSQL instance over a direct TCP connection**, adopting Prisma 7's new `@prisma/adapter-pg` driver adapter pattern — a non-trivial migration since Prisma 7 removed the `url` field from the schema's datasource block entirely.
3. **Payment model rethink.** Payments moved from a single hardcoded merchant account to a **per-organization BYOK (bring-your-own-keys) model**, where each organization stores its own encrypted Razorpay credentials (`OrgPaymentConfig`), so SFF acts as infrastructure rather than a payment intermediary.
4. **Async-first architecture.** Anything that could be slow, unreliable, or bursty (certificate generation, email/WhatsApp delivery, CSV export, analytics rollups) was pushed onto BullMQ background queues instead of blocking the request/response cycle.
5. **Product-market fit discovery via structured decision-making.** Feature sequencing was resolved using a self-designed "LLM Council" methodology — running major build-vs-skip decisions (e.g. "should we build a full visual canvas editor now, or a simpler split-pane preview?") through five independent AI advisor personas with peer review, to pressure-test decisions before committing engineering time. The council's verdict on the canvas editor, for example, was explicit: **defer it** — a canvas is the right long-term answer for spatial image placement, but premature for a 2-person team pre-launch; a split-pane live preview captures 80% of the value at 5% of the cost.

This project is as much a case study in **staged architecture evolution under real constraints** (a 2-person team, a single VPS, a live paying client) as it is a feature list.

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Language | TypeScript 5 (strict mode) |
| Backend framework | Express 5 |
| ORM | Prisma 7 with `@prisma/adapter-pg` driver adapter |
| Database | Self-hosted PostgreSQL (TCP, containerized) |
| Queue / background jobs | BullMQ 5 |
| Cache / queue broker | Redis 7 (via `ioredis`) |
| Auth | JWT in httpOnly cookies, `bcrypt`/`bcryptjs` password hashing |
| Payments | Razorpay (per-org BYOK model) |
| Email | Nodemailer (SMTP) |
| Messaging | WhatsApp Business HTTPS API |
| File storage | AWS S3 (`@aws-sdk/client-s3`, presigned uploads via `s3-request-presigner`) |
| Image processing | `sharp` |
| PDF / certificate generation | `pdfkit` |
| QR codes | `qrcode` |
| Validation | `zod` |
| Logging | `winston` + `winston-daily-rotate-file` |
| Security middleware | `helmet`, `express-rate-limit`, `rate-limit-redis` |
| Job dashboard | `@bull-board/express` (visual BullMQ queue inspector) |
| Testing | `vitest` |
| Frontend framework | Next.js (App Router) |
| Frontend language | TypeScript, React 18 |
| UI system | Tailwind CSS + shadcn/ui + Radix primitives |
| Data fetching | TanStack React Query v5 |
| Forms | `react-hook-form` + `zod` resolvers |
| Charts | `recharts` |
| Drag & drop | `@hello-pangea/dnd` |
| Animation | GSAP |
| Containerization | Docker Compose (5 services) |
| Reverse proxy | Nginx |
| CI/CD | GitHub Actions → GitHub Container Registry (GHCR) → VPS pull & restart |
| Infra | VPS (3 vCPU / 8GB RAM) |

---

## 4. Architecture

### 4.1 Layered Backend: Router → Controller → Service → Repository → Prisma

```
Request → Router → Controller → Service → Repository → Prisma → PostgreSQL
```

- **Controllers are thin.** They extract request data, call exactly one service method, and shape the HTTP response. No business logic lives here.
- **Services own all business logic** and are where cross-cutting orchestration happens.
- **Repositories are the only layer allowed to touch Prisma directly.** No raw SQL or Prisma calls anywhere else in the codebase.
- **Dependency injection via a central `container.ts`.** Services are never instantiated ad hoc inside another service — everything is wired once and pulled from the container. This keeps the dependency graph explicit and testable.

### 4.2 Domain Ownership by URL Prefix

Rather than a rigid one-service-per-table model, service boundaries are defined by **which URL prefix a resource lives under**, and the owning service is authoritative for that prefix — including reaching directly into peer repositories (not peer services) when it needs cross-entity data, to avoid service-to-service call chains for simple reads.

```
/contacts/*     → ContactService is authoritative; may read other repos directly
/events/*       → EventService; contactId is a plain filter here, not a nested resource
/forms/*        → FormService; always scoped by organizationId, never userId
/submissions/*  → SubmissionService
```

### 4.3 Async-First: BullMQ Fire-and-Forget + Frontend Polling

Certificate generation, CSV export, message sending, and analytics rollups are never done synchronously in the request path. The pattern is consistent across all of them:

```
Route → Controller → Service → Repo → BullMQ Queue → Worker → WorkerService → Provider
```

The frontend enqueues the job, gets an immediate response, and **polls** for job completion rather than blocking the connection or requiring WebSockets. A dedicated `worker` Docker container (separate from the API container) consumes the queues, so a burst of certificate-generation jobs during a live event cannot starve the API of resources.

Concrete pipeline example — **messaging**:
```
Route → Controller → MessageService → MessageRepo → BullMQ Queue
      → MessageWorker → MessageWorkerService → MessageProvider (Email | WhatsApp)
      → MessageTemplateResolver
```

Message retries reset a `FAILED` message back to `QUEUED` and **re-enqueue the same record** rather than duplicating it — important for keeping a clean audit trail of what was actually sent to a given contact.

### 4.4 Reliability Patterns Discovered the Hard Way

- **`Promise.all` instead of `prisma.$transaction`** for parallel *read* queries. Prisma's interactive `$transaction` callbacks were causing timeout issues on cold starts; switching parallel reads to `Promise.all` (with `$transaction` reserved only for genuinely atomic *writes*, e.g. "create submission + update contact") eliminated the timeouts.
- **Static imports only in BullMQ worker files.** A dynamic `import("../config/redis.js")` with an explicit `.js` extension silently failed to resolve under the CommonJS TypeScript build, causing jobs to fail with no visible error. Fixed by moving to static top-level imports everywhere in the worker layer.
- **Lazy instantiation for Nodemailer.** `nodemailer.createTransport(...)` must never be a top-level `const` — if it runs before `dotenv` has loaded environment variables, the transporter silently binds to `undefined` config and SMTP fails in a way that's hard to diagnose. Fixed with a lazy getter that constructs the transporter on first use.
- **`.env` values containing `$` must be quoted.** Docker Compose interprets unquoted `$` as variable substitution syntax and silently corrupts the value — this was the actual root cause of a production SMTP outage that looked, at first, like a credentials problem.

---

## 5. Payments — Razorpay, Per-Organization BYOK

Rather than SFF being a payment intermediary sitting between organizers and Razorpay, each organization connects **its own** Razorpay account. Credentials (`keyId`, `keySecretEnc`, `webhookSecretEnc`) are stored per-org in an `OrgPaymentConfig` table, encrypted at rest. This means:

- Money flows directly from attendee to organizer's own Razorpay account — SFF never touches settlement.
- Each org's webhook signature is verified against *that org's* webhook secret, not a shared platform secret.

Hard-won implementation details:

- **Razorpay's `receipt` field has an undocumented-in-practice 40-character hard limit** — exceeding it doesn't throw a validation error, it *silently* fails order creation. Fix: strip dashes from the UUID, take the first 30 characters, and prefix with `rcpt_`.
- **Webhook body must stay a raw buffer until after HMAC verification.** `express.raw({ type: 'application/json' })` must be registered *before* the JSON body parser on the webhook route, or the signature check runs against an already-mutated body and fails.
- **`app.set('trust proxy', 1)`** is required behind Nginx or Razorpay's IP-based checks and rate limiting misbehave.
- **Mobile UPI callback handling.** Razorpay's mobile redirect flow often omits the signature parameters that are present on desktop. The fix pattern: use `callback_url` with `redirect: false`, then have a dedicated `/payment/callback` page that **polls the database for payment status by `paymentId` query param** instead of trusting redirect parameters that may not be present.
- **Currency unit discipline.** The database stores amounts in **display units** (₹1 = `1`), and conversion to Razorpay's expected smallest-unit format (paise, ×100) happens only at the boundary where `orders.create` is called — never anywhere else in the codebase, to avoid unit-confusion bugs.

---

## 6. Multi-Tenancy — The Central Architectural Discipline

The single most important rule in the entire codebase: **every query touching organization-owned data must include `organizationId` in its `where` clause.**

```typescript
// ✅ Correct
async findById(formId: string, organizationId: string) {
  return prisma.form.findFirst({ where: { id: formId, organizationId } });
}

// ❌ Wrong — a cross-tenant data leak
async findById(formId: string) {
  return prisma.form.findUnique({ where: { id: formId } });
}
```

A full multi-tenancy audit (June 2026) went through every backend system — auth, events, forms, payments, certificates, submissions, contacts, messages, analytics, tags, files, and workers — and found (and fixed) several real leaks:
- The form service was filtering by `userId` instead of `organizationId`.
- `Event.findById` was missing an org assertion entirely.
- `Certificate.issueCertificate` was missing an org assertion entirely.

The standing regression discipline going forward:
- Every deploy runs an **org isolation smoke test**: verify Org A's data is never reachable using Org B's auth token.
- Every new endpoint must pass a code-review checklist item: *"Does this endpoint include an `organizationId` guard?"*
- The canonical automated test for this, present in the test suite, deliberately asserts a **404**, not a 403 — the API should behave as if the other org's resource doesn't exist at all, rather than confirming its existence via an access-denied response:

```typescript
it('should not return Org A data when authenticated as Org B', async () => {
  const orgAForm = await createForm(orgAToken);
  const response = await request(app)
    .get(`/api/forms/${orgAForm.id}`)
    .set('Cookie', orgBAuthCookie);
  expect(response.status).toBe(404);
});
```

---

## 7. Data Model (Prisma Schema Highlights)

The schema spans ~25 models. Key clusters:

**Identity & Org**
`User` → `Organization` (owned) → `OrganizationMember` (role: `OWNER` / `ADMIN` / `MEMBER`) → `Invite` (time-limited, single-use, tokenized team invitations with `PENDING`/`ACCEPTED`/`REVOKED`/`EXPIRED` states)

**Events & Forms**
`Event` (has `status`: `DRAFT`/`ACTIVE`/`CLOSED`, a `templateType` for certificates, optional payment config) → `Form` (one-to-one with Event, supports multi-step via `FormStep`, and — already schema-ready — `imageLayout`/`pageSettings` JSON columns for the upcoming branded-registration-page redesign) → `FormField` (typed: `TEXT`/`NUMBER`/`EMAIL`/`DATE`/`TEXTAREA`/`RANGE`/`CHECKBOX`/`RADIO`/`FILE`/`SELECT`)

**Visitors, Contacts & Deduplication**
`Visitor` (anonymous, cookie/UUID-tracked) → `VisitSession` (per event, status: `VISITED`/`STARTED`/`SUBMITTED`) → `Contact` (the deduplicated, org-independent global identity, unique on both `email` and `phone`) → `ContactEvent` (join table linking a contact to every event they've touched, tagged with a `ContactEventSource`: `FORM_SUBMISSION`/`PAYMENT`/`MANUAL`/`OTHER`)

**Submissions**
`FormSubmission` → `SubmissionAnswer` (a flexible, multi-typed answer row — `valueText`/`valueNumber`/`valueBoolean`/`valueDate`/`valueJson`/`fileUrl` — so one schema handles every field type without a table-per-type explosion)

**Drop-off / Funnel Analytics**
`PartialSubmission` — the evidence trail for an abandoned form: a JSON snapshot of whatever the visitor had filled in, the last field they touched, and the first *required* field they never reached (`dropoffFieldKey`). A confirmed drop-off is defined as: session status `STARTED`, no matching `FormSubmission`, and the session has gone cold.
`FieldDropoffStat` — a daily-bucketed, pre-aggregated rollup of drop-off counts per field, so the funnel widget in analytics doesn't have to re-scan raw partial-submission rows on every dashboard load.

**Payments**
`OrgPaymentConfig` (per-org encrypted Razorpay credentials — the BYOK model) → `PaymentConfig` (per-event amount/currency) → `Payment` (full lifecycle: `CREATED`/`PENDING`/`SUCCESS`/`FAILED`/`CANCELLED`/`REFUNDED`, with Razorpay order/payment IDs, webhook-confirmation flag, and attempt count)

**Certificates**
`Certificate` — one per submission, generated asynchronously (`QUEUED`/`PROCESSING`/`GENERATED`/`UPLOADED`/`FAILED`), templated by type (`ACHIEVEMENT`/`APPOINTMENT`/`COMPLETION`/`INTERNSHIP`/`WORKSHOP`), and linked to a `FileAsset` once rendered.

**Messaging**
`MessageTemplate` (a database-driven, two-layer template system — not hardcoded strings in TypeScript — scoped per-org with system-level fallback templates via `isSystem`) → `MessageLog` (full delivery record per channel: `EMAIL`/`WHATSAPP`/`SMS`, status `QUEUED`/`PROCESSING`/`SENT`/`FAILED`, provider response captured for debugging).

**Tags & Files**
`Tag` / `ContactTag` for lightweight contact segmentation. `FileAsset` as a generic storage-key/URL abstraction used by both form file-uploads and generated certificates.

---

## 8. Features Shipped

- Dynamic single-page and multi-step form builder with typed fields and validation
- Optional per-form payment collection (Razorpay, including mobile UPI callback handling)
- Public, unauthenticated form sharing with pagination-ready submission handling
- Org-level analytics dashboard (visits → starts → submissions funnel, daily rollups)
- Automated certificate generation via a dedicated BullMQ pipeline, five template types
- Email (SMTP) and WhatsApp (HTTPS API) messaging, driven by a database template system, with retry semantics
- Global contact management with deduplication by email and phone across every event
- Field-level drop-off / abandonment tracking with daily-bucketed funnel stats
- CSV export via fire-and-forget BullMQ job + frontend polling, with an audit trail
- Full org-scoped multi-tenancy across every backend subsystem
- Team collaboration: role-based membership (`OWNER`/`ADMIN`/`MEMBER`) with time-limited email invitations
- Onboarding progress tracking, modeled as a JSON checklist on the `Organization` record
- Per-organization Razorpay BYOK payment configuration
- httpOnly-cookie based JWT auth with a Redis-backed forgot-password flow
- CI/CD: GitHub Actions building Docker images → GHCR → VPS pull-and-restart deploy

---

## 9. Notable Engineering Challenges & Solutions

| # | Problem | Root Cause | Solution |
|---|---|---|---|
| 1 | SMTP silently broke in production | Docker Compose interprets unquoted `$` in `.env` as shell variable substitution, corrupting the SMTP password | Quote every `.env` value containing `$` |
| 2 | Nodemailer failed only in production, not local dev | `createTransport` was a top-level `const`, executed before `dotenv.config()` had populated `process.env` | Lazy-instantiate the transporter behind a getter function |
| 3 | Razorpay order creation silently failed for some orgs | `receipt` field exceeded Razorpay's undocumented 40-character limit (raw UUIDs are 36 chars once you add a prefix) | Strip dashes, truncate to 30 chars, prefix `rcpt_` |
| 4 | Razorpay webhook signature verification always failed | Express's JSON body parser ran before the raw-buffer capture needed for HMAC verification | Register `express.raw()` before `express.json()` specifically on the webhook route |
| 5 | BullMQ certificate jobs failed with zero error output | Dynamic `import('../config/redis.js')` doesn't resolve correctly under CommonJS-targeted TypeScript | Convert all worker-file imports to static top-level imports |
| 6 | Intermittent timeouts on cold starts under load | `prisma.$transaction` with interactive callbacks holds a DB connection open across multiple round-trips | Use `Promise.all` for parallel read-only queries; reserve `$transaction` only for atomic multi-table writes |
| 7 | Cross-tenant data leaks in three separate endpoints | Some early services filtered by `userId` or had no org filter at all, a holdover from the single-client-tool era | Full manual audit across every service + a standing "404, not 403" org-isolation test pattern |
| 8 | Contact database silently fragmented — same person, multiple contact records | Deduplication only recognized a field literally labeled `"phone"` — any variant (`Mobile Number`, `WhatsApp Number`, `Contact No.`) was ignored | Built a normalized field-alias registry (`fieldAliases.ts`) that maps dozens of real-world label variants to canonical `phone`/`email` properties, with logging for near-misses to iteratively expand the list |
| 9 | Filesystem-MCP-driven automated edits silently failed to apply | Windows CRLF line endings and Unicode box-drawing characters caused exact-match `oldText` comparisons to fail invisibly | Always re-read a file immediately before an automated edit to confirm exact byte-for-byte content |
| 10 | Prisma 7 upgrade broke the datasource config | Prisma 7 removed the `url` field from `schema.prisma`'s `datasource` block entirely, moving connection config to code | Migrated to `@prisma/adapter-pg` with an explicit `PrismaPg` adapter instance constructed in `prisma.config.ts` and passed into the `PrismaClient` constructor |

---

## 10. Testing

Testing was the single most significant gap identified in an engineering self-assessment, and it's the area with the most deliberate, documented remediation plan of any part of the project — used explicitly as a **career-development milestone** en route to SDE-2/senior-level positioning.

The strategy: don't try to blanket the whole codebase — start with the **three highest-risk endpoints**, where a bug has real financial or data-integrity consequences:

1. `POST /forms/:id/submit` — submission creation + contact deduplication correctness
2. `POST /payments/webhook` — Razorpay HMAC signature verification + order status transitions
3. `GET /submissions` — cross-org data isolation (the 404-not-403 pattern above)

**Stack:** Vitest + Supertest for backend integration tests; Vitest + React Testing Library planned for frontend.

Tests currently in place cover: contact deduplication logic, analytics org-isolation, drop-off tracking org-isolation, and form image-zone handling — with the org-isolation smoke test treated as a mandatory pre-deploy gate rather than optional coverage.

---

## 11. Infrastructure & Deployment

```
                     ┌────────────┐
   Internet ───────▶ │   Nginx    │  (reverse proxy, SSL termination)
                     └─────┬──────┘
                ┌──────────┴──────────┐
                ▼                     ▼
        ┌───────────────┐     ┌───────────────┐
        │ frontend:3000 │     │ backend:4000  │
        │   (Next.js)   │     │  (Express 5)  │
        └───────────────┘     └───────┬───────┘
                                       │
                       ┌───────────────┼───────────────┐
                       ▼               ▼               ▼
                ┌───────────┐  ┌─────────────┐  ┌─────────────┐
                │  worker   │  │  redis:6379 │  │postgres:5432│
                │ (BullMQ)  │  │  (internal) │  │  (internal) │
                └───────────┘  └─────────────┘  └─────────────┘
```

- **5-container Docker Compose topology**: frontend, backend, worker, Redis, PostgreSQL — the worker is deliberately isolated from the API container so a burst of background jobs during a live event can't degrade request latency for concurrent users.
- **VPS:** 3 vCPU / 8GB RAM, single host, all containers co-located — a known, explicitly flagged scaling risk. Load testing (k6, 200–500 concurrent virtual users against the submission endpoint) and Docker per-container resource limits are on the roadmap specifically to establish the real ceiling before public marketing launch.
- **CI/CD:** GitHub Actions builds Docker images on push → pushes to GHCR (`ghcr.io/ysmsoftware`) → VPS pulls and restarts via `docker compose pull && docker compose up -d`.
- **Database migration protocol (production):** a strict two-phase approach for any schema change touching existing data — Phase 1 applies only additive, nullable columns directly via `psql`, then registers the migration as applied without re-running it (`prisma migrate resolve --applied`); Phase 2 (constraints, `NOT NULL`, unique indexes) is applied only after the corresponding code is deployed and any backfill has completed. `prisma migrate dev` is never run against production, and files inside `prisma/migrations/` are treated as CLI-generated-only — never hand-edited, to avoid corrupting the `_prisma_migrations` history table.

---

## 12. Design & Architectural Principles Applied

- **Two-tier form editability** — presentation-layer changes (images, colors) remain editable after a form is published; the field schema itself freezes at publish time, so historical submissions always map cleanly to the form structure that existed when they were made.
- **Database-driven templates, not hardcoded strings** — both message templates and (implicitly) certificate templates are data, not code, so non-engineers can eventually manage them without a deploy.
- **Public/authenticated boundary is a hard line** — payment webhooks and public form endpoints trust only cryptographic signatures (Razorpay HMAC) or explicit request-body identifiers, never session/auth state, because they're reached by external systems or anonymous visitors.
- **File uploads trust the request body for `organizationId`, not the JWT** — a deliberate exception to the "always scope from the token" rule, needed because some upload flows originate from contexts (like anonymous public form submissions) where there is no authenticated org context to draw from.
- **Sequencing discipline over feature completeness** — every major build-vs-skip decision (canvas editor vs. split-pane preview, ML-based field detection vs. curated alias list, full ad-analytics dashboards vs. UTM capture first) was deliberately resolved toward the simplest viable implementation given a 2-person team and finite pre-launch runway, with the more ambitious version explicitly deferred and documented rather than either being built prematurely or forgotten.

---

## 13. What's Next — Roadmap

**Pre-launch blockers (Tier 0):** contact-dedup fix (shipped), legal/privacy pages, Sentry + uptime monitoring, a public pricing page.

**Pre-marketing gate (Tier 1):** infrastructure load testing + Cloudflare + rate limiting, a frontend UI for the already-built team/role backend, completing drop-off tracking, a guided onboarding flow, PostHog analytics behind cookie consent.

**Post-first-10-clients (Tier 2):** a branded public form page with image zones (schema already supports this), a real-time split-pane live preview, a full SaaS-grade UI redesign informed by real session recordings rather than guesswork, Google/Apple SSO, and UTM/Meta Pixel/GA4 attribution.

**Growth/Scale tier roadmap:** a full visual canvas editor for spatial image placement (deliberately deferred, not skipped), an event-microsite builder, an append-only audit log, white-labeling with custom domains, and offline-first form submission via IndexedDB + Background Sync.

**Separate future product:** a **CRM Builder** — a lightweight, automation-driven, multi-workflow Salesforce alternative, positioned as SFF's next major product line rather than a feature of the current one.

---

## 14. Summary for a Portfolio Reader

SmartFormFlow is best framed not as "a form builder" but as a case study in taking a **working single-client tool into a properly multi-tenant, payment-capable, asynchronously-processed SaaS platform** under real constraints — a 2-person team, a single VPS, and a live client whose event traffic couldn't be disrupted during the migration. The interesting engineering is less in any individual feature and more in:

- The discipline required to retrofit multi-tenancy safely (and prove it stays safe, via automated org-isolation tests)
- Designing an async job pipeline (BullMQ) that isolates unpredictable workloads (certificate generation, messaging) from user-facing request latency
- A string of production incidents that were each root-caused precisely and turned into standing rules (the `.env` `$` issue, the Nodemailer lazy-init issue, the Razorpay receipt-length issue, the webhook raw-body-ordering issue) rather than one-off patches
- Making deliberate, documented trade-off decisions about what *not* to build yet (canvas editor, ML-based dedup, full ad-platform integrations) in favor of the simplest version that ships value now
