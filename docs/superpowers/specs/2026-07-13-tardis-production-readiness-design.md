# TARDIS Production-Readiness Design

**Date:** 2026-07-13  
**Status:** Approved architecture; implementation specification  
**Scope owner:** TARDIS workspace (`furniture-web`, `landing-web`, `tardis`, `tardis-admin`, `tardis-edge`, `tardis-embed`)

## 1. Goal and completion boundary

Make the approved core B2B product work end to end so that the remaining work is deployment and external account configuration:

1. A retailer creates an account and configures allowed storefront origins in `tardis-admin`.
2. The retailer creates an object or surface product.
3. Object products consume one generation credit and run through the real Modal generation pipeline.
4. Surface products publish a managed pattern/color catalog without invoking the object-generation GPU path.
5. Stable assets are stored in GCS-compatible object storage and a canonical product resolution is published to Firestore-compatible storage.
6. `tardis-edge` resolves the product with tenant and origin isolation and ingests attributed analytics.
7. `tardis-embed` opens the real product, launches supported AR, and reports `ar_open` and `ar_view` without affecting the host page on failure.
8. `furniture-web` demonstrates the real installed embed and `landing-web` accurately funnels B2B leads into the product.
9. Every repository has a truthful, passing local verification gate and deployment documentation/configuration examples.

The production boundary deliberately excludes three separately licensed or product-level phases that were not selected for this core release:

- Stripe charging and subscriptions.
- Zappar Mattercraft licensing/integration.
- The native iOS App Clip.

Those exclusions must not leave fake production behavior. Production billing must not grant free credits, the surface viewer must be labelled preview-grade, and no public page may claim that the App Clip or Mattercraft tier is currently active.

The existing Vastra iOS application remains in scope for build hygiene, configuration safety, and preservation of its current consumer functionality. Creating the separate App Clip target is outside this release.

## 2. Chosen approach

Use a contract-first vertical slice rather than completing repositories independently.

The current repositories compile mostly in isolation but disagree at runtime:

- Admin generates `pub_` keys while backend/edge accept `pk_` keys.
- Admin snippets use `data-tardis-ar`; the loader scans `data-tardis` plus `data-product`.
- The embed calls `/v1/embed/resolve` with `X-Tardis-Key`; edge exposes `/resolve` with `X-Tenant-Key`.
- Backend/edge call a surface catalog `surfaceCatalog`; the viewer expects `surfaces` and `defaultSurfaceId`.
- The embed emits no analytics.
- Generation stores only one durable asset and does not publish a complete resolution.

Implementation therefore starts with canonical contracts and fixtures, then makes each producer and consumer conform, then verifies the whole flow locally.

## 3. System ownership

### `tardis-admin` — control-plane source of truth

Owns users, organizations, memberships, catalog records, credit accounting, desired embed configuration, surface catalogs, and the durable outbox used to request external side effects.

It never serves a shopper request and never exposes a tenant secret key to the browser.

### `tardis` — generation and publication control plane

Owns source-asset ingestion, durable generation jobs, task dispatch, Modal execution, generated-asset storage, tenant-key provisioning, and publication of denormalized resolutions.

The current consumer endpoints remain compatible. The B2B endpoints use tenant or internal-service authentication and idempotency.

### `tardis-edge` — shopper data plane

Owns low-latency resolution and analytics ingestion. It reads denormalized Firestore data and publishes analytics to Pub/Sub. It never calls Postgres, Modal, or the admin application on the shopper hot path.

### `tardis-embed` — isolated shopper client

Owns host-page trigger discovery, resolution, overlay/viewer behavior, object AR, preview-grade surface rendering, and best-effort analytics. It must remain dependency-free on the host page, isolated, lazy, and fail-safe.

### `furniture-web` — sales and working demo

Owns the realistic retailer/product demo used to prove the installed widget. Existing consumer generation may remain as a secondary demo, but the main B2B claim must be demonstrated through the production embed contract.

### `landing-web` — marketing and lead capture

Owns B2B positioning, SEO, trust/legal content, and lead capture. It does not call generation or shopper data-plane services.

## 4. Canonical version-one contracts

Each contract is represented by golden JSON fixtures in the producing/consuming repositories. Contract tests must reject drift.

### Tenant key record

```ts
interface KeyRecord {
  key: string;             // pk_... or sk_...
  orgId: string;
  allowedOrigins: string[];
}
```

- `pk_` keys are public, read-only, and origin-scoped.
- `sk_` keys are server-only and not origin-scoped.
- Admin stores the publishable key directly and stores the secret key encrypted with AES-GCM using `KEY_ENCRYPTION_SECRET`.
- Firestore key documents are keyed by the raw key string.
- Rotation revokes the previous key; retaining an active old key is a failed rotation.
- Public key lookup failures do not reveal whether a key or product exists.

Allowed origins are stored as schemeful patterns:

- Exact: `https://shop.example.com`
- Explicit local development: `http://localhost:3000`
- Wildcard subdomain: `https://*.example.com`

Bare domains entered in the UI normalize to HTTPS. Wildcards match subdomains only, not the apex. Paths, query strings, fragments, user info, and a global `*` are rejected outside the explicit local development seed.

### Product resolution

```ts
type ResolutionMode = "object" | "surface";

interface SurfaceSwatch {
  id: string;
  label: string;
  kind: "pattern" | "color";
  textureUrl?: string;
  color?: string;
  thumbUrl?: string;
  repeat?: number;
}

interface ProductResolution {
  productId: string;
  name: string;
  mode: ResolutionMode;
  modelUrl?: string;
  usdzUrl?: string;
  posterUrl?: string;
  surfaces?: SurfaceSwatch[];
  defaultSurfaceId?: string;
}
```

Firestore documents also store `orgId` for ownership and operational inspection, but the public resolver response omits it.

Validation rules:

- Object mode requires at least one of `modelUrl` or `usdzUrl`; production generation normally publishes both.
- Surface mode requires at least one valid swatch and a `defaultSurfaceId` present in the catalog.
- Pattern swatches require an HTTPS `textureUrl`; color swatches require a valid CSS hex color.
- URLs must point to configured public asset/CDN origins in production.
- Published assets use immutable keys containing organization, product, generation/version, and file name.

### Analytics event

```ts
interface AnalyticsEvent {
  eventId: string;         // UUID generated by the embed
  key: string;             // pk_...
  orgId: string;           // collector-enriched, never trusted from the client
  product: string;
  type: "ar_open" | "ar_view";
  ts: number;              // Unix seconds
  origin: string;          // collector-observed and normalized
}
```

The collector resolves `key -> orgId`, enforces the same allowed-origin rules as the resolver, and overwrites any client-supplied attribution. Invalid events are dropped with a non-enumerating response. `eventId` is the BigQuery deduplication key.

### Embed HTML contract

```html
<script
  src="https://cdn.example.com/v1/embed.js"
  data-tardis-key="pk_live_..."
  data-tardis-api="https://edge.example.com"
  data-tardis-collector="https://collector.example.com"
  defer
></script>

<button data-tardis data-product="SKU-123" data-mode="auto">
  View in your room
</button>
```

The resolver endpoint is `GET /resolve?product=SKU` with `X-Tenant-Key`. The collector endpoint is `POST /events`. Admin snippets, docs, demos, and loader parsing use exactly these names.

## 5. Control-plane flows

### 5.1 Tenant provisioning and configuration

1. Signup transaction creates the organization, subscription, membership, `pk_` key, encrypted `sk_` key, and an outbox event.
2. A protected backend tenant-provisioning endpoint authenticates `B2B_ADMIN_TOKEN` and idempotently writes/revokes Firestore key records.
3. Domain and key changes update Postgres plus the outbox in one transaction.
4. A dispatcher attempts delivery immediately after the action and leaves failed events durable for retry.
5. A protected dispatcher route supports Cloud Scheduler in production; deployment supplies the scheduler invocation and shared token/IAM policy.
6. The Embed page displays synchronization state. A configuration is not described as live until the relevant outbox event succeeds.

This outbox prevents a successful UI response from silently leaving Postgres and Firestore inconsistent.
Outbox payloads reference the organization/key version; they never contain a raw secret key. The dispatcher decrypts the current secret server-side only when a request requires it. Product upload/generation controls remain unavailable until initial tenant-key synchronization succeeds.

### 5.2 Safe source ingestion

Photo input:

1. Admin validates MIME type, byte size, and image dimensions server-side.
2. Admin sends bytes to the tenant-authenticated source-asset endpoint.
3. Backend decodes and re-encodes the image, stripping metadata, and stores it under an immutable source key.

Product URL input:

1. Admin's server-only ingestion module accepts only HTTP(S).
2. DNS resolution rejects loopback, link-local, private, multicast, reserved, and cloud-metadata addresses for every redirect hop.
3. Fetches have strict redirect, body-size, content-type, and time limits.
4. JSON-LD and Open Graph metadata provide the product name and primary image.
5. The chosen image is fetched through the same SSRF checks, decoded, re-encoded, and uploaded through the source-asset endpoint.

The same reusable SSRF policy protects `furniture-web` scraping and image proxy routes.

### 5.3 Object generation

1. Admin transaction verifies ownership, serializes the credit balance, appends a one-credit debit, creates a pending generation job, and writes a `generation.submit` outbox event.
2. The dispatcher calls `POST /b2b/generate/async` with the tenant secret key and the admin generation-job UUID as the idempotency key.
3. Backend creates or returns the same durable job and enqueues work through `TaskQueue`.
4. Local development uses an in-process queue. Production uses Cloud Tasks calling a protected worker endpoint. Modal work is not tied to the lifetime of the original HTTP request.
5. The worker marks the job processing, invokes Modal, validates both outputs, and stores GLB and USDZ under immutable object keys. The sanitized source image is the initial poster.
6. Backend publishes the complete resolution only after durable asset writes succeed.
7. Backend marks the job finished and sends a signed best-effort completion webhook to admin. Admin also reconciles by polling, so webhook loss is harmless.
8. Admin marks the product ready and records final URLs. A terminal generation failure appends one idempotent credit refund and exposes a retry action.

The public consumer generation routes use the same durable queue/storage primitives when configured, while retaining their current request and response shapes.

### 5.4 Surface catalog publication

Surface products do not call Hunyuan and do not consume object-generation credits.

1. Admin creates the product and at least one pattern or color swatch.
2. Pattern and thumbnail images pass through source ingestion and immutable object storage.
3. The product editor supports add, edit, remove, reorder, and default-swatch selection.
4. Saving writes the catalog and a `resolution.publish` outbox event in one transaction.
5. Backend validates and publishes the surface resolution to Firestore.
6. The viewer continues using the existing TensorFlow/DeepLab preview-grade engine and visibly labels color/lighting limitations.

Deleting or unpublishing a product removes its resolution through an explicit tombstone/revocation operation; stale CDN success responses use a short bounded TTL and are purged during deployment where available.

### 5.5 Analytics

1. Opening the overlay emits `ar_open` once per open session.
2. A successfully presented 3D model, launched native AR session, or running surface camera engine emits `ar_view` once per session.
3. The loader uses `sendBeacon` where possible and a short-timeout `fetch(..., keepalive: true)` fallback. Analytics failures never affect viewing.
4. Collector validates shape and size, resolves the publishable key, checks the request origin, enriches organization attribution, and publishes JSON to Pub/Sub.
5. Pub/Sub-to-BigQuery provisioning is deployment work. The checked-in schema and sample provisioning commands exactly match the event contract.
6. Admin uses an `AnalyticsRepository`: Postgres aggregated rows for local/test mode and BigQuery queries in production. Both return the existing dashboard view model.

## 6. Repository-specific implementation requirements

### `tardis-edge`

- Implement Firestore resolution/key stores and Pub/Sub event sink.
- Make cloud clients lazy but fully functional and validate required project/topic/collection configuration at startup.
- Share exact origin-matching logic between resolver and collector.
- Keep resolver cache/CORS invariants and non-enumerating errors.
- Add key lookup caching with a short TTL and explicit invalidation-safe upper bound.
- Enrich analytics without trusting client organization data.
- Add emulator/fake-client contract tests plus existing in-memory tests.

### `tardis`

- Complete Firestore key CRUD and publisher operations.
- Evolve durable jobs to include organization, product, idempotency key, mode, source asset, GLB/USDZ/poster URLs, attempts, and timestamps.
- Make SQLite and Postgres implementations behaviorally identical.
- Add local and Cloud Tasks queue adapters.
- Add tenant provisioning, source upload, B2B generation/status, and signed webhook endpoints.
- Store and publish all generated formats, not only the native result.
- Serve/redirect durable downloads when local files are absent.
- Fix pytest discovery so the documented `pytest -q` gate passes without accidentally collecting the CLI smoke client.
- Remove real-looking secrets from the iOS source, use generated/ignored xcconfig values, and provide a committed example.
- Regenerate the Xcode project from `project.yml`; never hand-edit structural project changes.

### `tardis-admin`

- Add migrations for encrypted tenant secret keys, surface swatches, durable outbox, backend task IDs, refund ledger entries, and synchronization state.
- Replace simulated generation and hardcoded Astronaut assets with the real client/outbox/reconciliation flow.
- Replace `upload:<filename>` with validated uploaded source assets.
- Reconcile all snippets and guides with the canonical embed contract.
- Normalize origin patterns and synchronize them through the outbox.
- Complete the Settings page for organization profile, members/roles, invite links, and key/configuration status. Invite links are functional without requiring an email provider.
- Make production billing read-only/contact-sales unless a real provider is configured; the no-charge provider is development/test-only and cannot grant credits in production.
- Implement the production BigQuery analytics repository behind the same dashboard view model as the local Postgres repository.
- Keep tenant scoping, ledger locking, feature merges, and dynamic-rendering invariants.
- Add integration tests against local Postgres for credits, outbox idempotency, tenant isolation, generation refund, and key rotation.

### `tardis-embed`

- Replace demo normalization with strict canonical resolution parsing.
- Demo fallback is allowed only when an explicit demo flag/override is present. A configured production failure renders a contained retry/error state, never another product's demo asset.
- Use canonical endpoints, headers, attributes, surface field names, and snippets.
- Add analytics session tracking with `eventId` UUIDs and beacon/fetch delivery.
- Keep the loader under the 10 KB gzip budget, one global, Shadow DOM/iframe isolation, lazy heavy chunks, sandbox restrictions, and origin/source-checked messaging.
- Add automated loader/resolver/protocol/analytics tests and a browser smoke test for the demo PDP.

### `furniture-web`

- Fix the crashing ESLint configuration.
- Apply SSRF protections to scrape and image proxy routes.
- Add a working B2B retailer demo driven by environment-provided widget, edge, collector, key, and sample product values.
- Make unavailable configuration produce an honest demo-unavailable state rather than silently calling localhost or exposing internal errors.
- Keep the consumer demo only where it remains truthful and functional.
- Add tests for pure URL policy/normalization and critical BFF behavior.

### `landing-web`

- Align primary positioning and CTAs with the B2B embed product while preserving validated SEO behavior.
- Keep the Notion waitlist contract and add a complete `.env.example`.
- Ensure public claims match the core boundary: object AR and preview-grade web surfaces are live; Stripe, Mattercraft, and App Clip are not represented as shipped.
- Preserve or deliberately update the exact SEO assertions with copy changes.

## 7. Reliability and security rules

- Shopper requests never touch Postgres, admin, or Modal.
- Tenant ownership is derived from authenticated keys/session context, never client-supplied `orgId`.
- Secret keys and internal tokens never use `NEXT_PUBLIC_*` variables or browser bundles.
- All external calls have explicit connect/read/total timeouts and bounded payload sizes.
- Retryable operations are idempotent; outbox events, generation submissions, refunds, key updates, and analytics events have stable identifiers.
- Firestore/object writes occur before a ready status is visible.
- Cloud adapter misconfiguration fails startup/health checks clearly rather than degrading to an in-memory production store.
- Local defaults remain convenient only in development/test mode.
- Logs contain organization/job/product identifiers but not raw keys, source images, credentials, or full email addresses.
- Public errors contain actionable user language without stack traces or internal commands.
- Key rotation revokes old access; product deletion revokes resolution; account deletion removes or tombstones tenant data according to retention policy.
- Existing consumer auth (`X-API-Key`), tenant auth (`X-Tenant-Key`), and internal service auth remain distinct.

## 8. User-facing error behavior

- Admin distinguishes validation, insufficient credits, queued work, retryable service outage, terminal generation failure, and configuration-sync failure.
- A failed submit leaves a durable job/outbox record and does not double-debit on retry.
- A terminal object-generation failure refunds exactly once.
- Embed resolution failure stays inside the overlay with retry and close controls.
- Unsupported object AR falls back to interactive 3D.
- Unsupported surface hardware shows the existing honest still/unsupported path; it never claims native fidelity.
- Edge resolver errors are non-cacheable; successful immutable asset responses remain CDN-cacheable.
- Collector failures are invisible to the shopper and do not prevent overlay/viewer actions.

## 9. Verification strategy

### Contract gates

- Golden valid and invalid fixtures for key records, object resolutions, surface resolutions, and analytics events.
- Backend, edge, embed, and admin tests load the same logical fixtures and assert identical field names and validation outcomes.
- A workspace verification script compares checked-in fixture hashes and runs the local cross-repo scenario when sibling repositories are present.

### Repository gates

- `furniture-web`: tests, `npm run lint`, `npm run build`.
- `landing-web`: `npm test -- --runInBand`, `npm run lint`, `npm run build`.
- `tardis-admin`: unit tests, live-Postgres integration tests, `npm run lint`, `npm run build`.
- `tardis-edge`: complete `pytest -q`, resolver and collector container builds.
- `tardis-embed`: tests, `npm run typecheck`, `npm run build`, gzip budget, browser smoke.
- `tardis` backend: complete `pytest -q`, mock server smoke, container build.
- Vastra iOS: `xcodegen generate` produces no unexpected project drift, then unsigned generic-device `xcodebuild` succeeds with the Metal toolchain installed.

### Local end-to-end gate

The automated scenario uses local Postgres, SQLite/in-memory backend adapters, local object storage, local edge stores, and mock generation:

1. Create tenant and credits.
2. Synchronize `pk_`/`sk_` records and allowed origin.
3. Upload a source image.
4. Submit an object generation twice with the same idempotency key and prove one debit/job.
5. Complete mock generation with GLB/USDZ/poster and publish resolution.
6. Resolve through edge from an allowed origin and reject a disallowed origin/cross-tenant key.
7. Open the embed demo and verify the canonical asset is used.
8. Emit open/view events and verify enriched collector output.
9. Publish and resolve a multi-swatch surface catalog.
10. Force a terminal generation failure and prove exactly one refund.
11. Rotate the public key and prove the old key no longer resolves.

No completion claim is valid until this scenario and every repository gate pass from clean worktrees.

## 10. Delivery sequence

The work is divided into independently verifiable subprojects, each receiving its own implementation plan and test cycle:

1. Canonical contracts and cross-repo fixtures.
2. Edge cloud adapters, auth/origin parity, and attributed analytics.
3. Backend durable jobs, asset storage, task queue, tenant provisioning, and publication.
4. Admin schema/outbox, source ingestion, real object generation, surface catalog, configuration sync, and safe billing state.
5. Embed production resolver, analytics, strict failure behavior, and automated tests.
6. Local end-to-end harness and cross-repo contract verification.
7. Furniture demo/security/readiness.
8. Landing positioning/configuration/readiness.
9. Vastra configuration hygiene and final iOS build verification.
10. Full clean-worktree completion audit and deployment handoff.

This sequence follows dependency direction: contracts before implementations, producers before consumers, then public surfaces and whole-system proof.

## 11. Deployment-only handoff

After implementation, the user is responsible for supplying/provisioning:

- GCP project, service accounts, IAM, Secret Manager values, and region.
- GCS buckets/load balancer/Cloud CDN.
- Firestore database and indexes.
- Pub/Sub topic and BigQuery subscription/table.
- Cloud Tasks queue and Cloud Scheduler trigger for the admin outbox dispatcher.
- Cloud SQL/Postgres instance and applying committed migrations.
- Cloud Run services/domains, environment variables, and internal service authentication.
- Modal credentials/app deployment and third-party generation/preview/research credentials.
- Notion credentials/database schema for lead capture.
- DNS, production origins, sample tenant keys/products, and CDN asset paths.
- Apple signing/provisioning and physical-device validation for the existing Vastra app.

The repositories must contain validated environment examples, health checks, migrations, Docker/build definitions, provisioning references, and local substitutes so none of those deployment steps require product-code invention.
