# TARDIS — Backend B2B-Readiness & Scale Design (GCP-native)

*Date: 2026-07-03 · Status: **approved** · Stack: **GCP** (funded by the founder's Google grant credits — TARDIS is a personal pet project, separate from Leaply).*

---

## Core principle: two planes, hard-separated

Everything scales trivially **except** a few backend touchpoints. Keep the **shopper hot-path (data-plane)** on static + edge-cached + client-side; keep everything dynamic/expensive in the **control-plane (per-client, low QPS)**. A shopper action must never touch Postgres or the GPU.

| | Data-plane (shopper) | Control-plane (client) |
|---|---|---|
| **Traffic** | High, spiky (thousands concurrent) | Low (per-client admin use) |
| **Must be** | Static / edge-cached / on-device | Normal server + DB |
| **Contains** | loader, viewer, resolver, model assets, analytics ingest | admin app, credits ledger, catalog, generation |

---

## Data-plane (the hot-path — GCP)

1. **Loader + viewer** — static, immutable, **versioned paths** on **GCS + Cloud CDN**. Pure cache hits; near-zero origin load.
2. **Resolver** — `GET /resolve?key=pk_…&product=SKU` → `{ mode, modelUrl, usdzUrl, poster, surfaceCatalog }`.
   - A tiny **Cloud Run** service behind **Cloud CDN**, reading a **denormalized store (Firestore)** — *not* Postgres.
   - **Edge-cached** at Cloud CDN via `Cache-Control` + `stale-while-revalidate`; resolutions are near-static per product, so it collapses to CDN hits.
   - Enforces the **per-key origin allowlist** here.
3. **Model assets** (GLB/USDZ/poster/surface textures) — **GCS + Cloud CDN**, immutable per-version URLs. Replaces today's ephemeral in-memory + tempdir store (which loses models on restart and can't survive multiple instances — the hard blocker at scale).
4. **Analytics ingest** — `ar_open` / `ar_view` posted **fire-and-forget** from the widget to a **Cloud Run collector** → **Pub/Sub** → **BigQuery** (you already use BigQuery). Never blocks the widget; the widget already has hard timeouts + graceful degrade.

**Failure posture:** resolver cache-miss falls back to a Firestore read (then re-cached); generation/DB outages don't touch the data-plane; GCS + Cloud CDN are the durability boundary. If everything dynamic is down, installed widgets still serve the last-published model.

---

## Control-plane (per-client, low QPS)

- **Admin app** (Next.js + Postgres/Drizzle — already built): tenants, catalog, **credits ledger**, embed config, analytics views. Source of truth for tenant/catalog/billing state. Can run on **Cloud Run** (or GKE).
- **Generation service** (existing Python FastAPI + **Modal** GPU — unchanged for generation). Two additions:
  - **Durable job store** — replace the in-memory dict with a persisted jobs table (Postgres) so jobs survive restarts and scale across instances.
  - **Publish step** — when a model is `ready`, write the asset to **GCS** and push the **denormalized resolution into Firestore**, so the resolver serves it without touching Postgres.
- **Keys:** public **publishable keys** (`pk_…`, embedded, read-only resolve, origin-scoped) vs **secret keys** (`sk_…`, server-side). Replaces the current single global `X-API-Key` + `CORS:*` — **additively**, so the existing consumer app + iOS app keep working on the global key.

---

## The one dataflow that ties it together

```
Admin "Add item" → debit 1 credit → Generation (Modal) → asset → GCS/Cloud CDN
                                                        → publish resolution → Firestore
Shopper taps button → widget → Cloud Run resolver (Firestore read, origin check, Cloud CDN cache) → GCS asset → on-device render
                    → ar_open/ar_view → Cloud Run collector → Pub/Sub → BigQuery
```

Generation happens **once per product** (control-plane); shoppers only read cached CDN/Firestore data. That's what makes thousands of concurrent shoppers a non-event.

---

## Changes in the existing `tardis` backend (additive, non-breaking)

1. Durable model/asset storage on **GCS + Cloud CDN** (replaces ephemeral tempdir/in-memory) — *the* prerequisite.
2. Durable generation job store (Postgres) — replaces the in-memory job dict.
3. Per-tenant publishable/secret keys + origin allowlist — added **alongside** the existing global key (consumer + iOS untouched).
4. A **publish-to-Firestore** step on generation completion.
5. New **Cloud Run** services: the resolver + the analytics collector.

Generation (Modal/Hunyuan) and the room/research features are unchanged. The FastAPI backend can migrate from Render to **Cloud Run / GKE** to sit inside the grant.

---

## Provisioning (your side — needs the GCP account/credits)

GCS buckets (assets + versioned static), Cloud CDN, Cloud Run (resolver, collector, optionally the API), Firestore (resolutions + key records), Pub/Sub topic + BigQuery dataset (analytics), Secret Manager (keys). All code is written against interfaces with **local/in-memory implementations for tests**, so it builds and is verified locally now; the GCP wiring is deploy-time config on your project.
