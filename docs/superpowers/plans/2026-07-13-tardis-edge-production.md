# TARDIS Edge Production Adapters Implementation Plan

> **Execution:** Follow this plan test-first in the existing `tardis-edge` `codex/contracts-v1` worktree. Keep GCP imports lazy and preserve resolver CORS/cache/error invariants.

**Goal:** Make the resolver and collector deployable on Cloud Run with functional Firestore/Pub/Sub adapters, bounded key caching, fail-fast production configuration, and tenant-attributed analytics.

**Architecture:** The resolver reads tenant keys and product resolutions from Firestore. The collector accepts only client event fields, resolves the publishable key through the same `KeyStore` and origin policy, creates an internal `AttributedAnalyticsEvent`, and synchronously confirms bounded Pub/Sub acceptance before returning the same non-enumerating `202` response. Local development retains injectable in-memory adapters.

**Tech stack:** Python 3.11+, FastAPI, `google-cloud-firestore`, `google-cloud-pubsub`, pytest, Cloud Run, Firestore, Pub/Sub, BigQuery.

---

## Task 1: Functional Firestore adapters

**Files:**
- Create: `tardis-edge/tests/test_cloud_adapters.py`
- Modify: `tardis-edge/shared/key_store.py`
- Modify: `tardis-edge/shared/resolution_store.py`

- [x] **Step 1: Add failing fake-client tests**

Create small fake Firestore snapshot/document/collection/client classes in `tests/test_cloud_adapters.py`. The fake document supports `get()` and `set(data)`, and records the selected collection and document id.

Cover these behaviors:

```python
def test_firestore_resolution_store_roundtrip_and_tenant_keying():
    client = FakeFirestoreClient()
    store = FirestoreStore(project="project", collection="resolutions", client=client)
    resolution = Resolution.from_dict(fixture("resolution.object.valid.json"))
    store.put(resolution)
    assert client.last_document_id == "org_fixture:chair-001"
    assert store.get("org_fixture", "chair-001") == resolution
    assert store.get("other", "chair-001") is None


def test_firestore_key_store_uses_document_id_as_key():
    client = FakeFirestoreClient()
    client.seed("tenant_keys", "pk_fixture", {
        "orgId": "org_fixture",
        "allowedOrigins": ["https://shop.example.com"],
        "key": "sk_untrusted",
    })
    store = FirestoreKeyStore(project="project", collection="tenant_keys", client=client)
    assert store.get("pk_fixture").key == "pk_fixture"
    assert store.get("pk_missing") is None


@pytest.mark.parametrize("factory", [FirestoreStore, FirestoreKeyStore])
def test_firestore_adapters_reject_missing_configuration(factory):
    with pytest.raises(ValueError):
        factory(project="", collection="records")
    with pytest.raises(ValueError):
        factory(project="project", collection="")
```

- [x] **Step 2: Run the tests and confirm the skeleton fails**

Run: `pytest tests/test_cloud_adapters.py -q`

Expected: FAIL because neither adapter accepts an injected client and both operational methods raise `NotImplementedError`.

- [x] **Step 3: Implement Firestore resolution reads/writes**

In `shared/resolution_store.py`:

- Validate non-empty `project` and `collection` in `__init__`.
- Accept an optional keyword-only `client` for tests.
- Keep `from google.cloud import firestore` inside `_fs()`.
- `get()` returns `None` for a missing snapshot and otherwise parses `snapshot.to_dict()` through `Resolution.from_dict`.
- `put()` validates/serializes through `resolution.to_dict()` and calls `.set(...)` on the composite document id `orgId:productId`.

- [x] **Step 4: Implement Firestore key reads**

In `shared/key_store.py`:

- Validate configuration and accept optional injected client.
- Return `None` immediately for malformed key prefixes.
- Read a document whose id is the requested key.
- Parse `{**snapshot.to_dict(), "key": requested_key}` so stored data cannot change key identity.
- Reject malformed records through the shared contract rather than treating them as privileged.

- [x] **Step 5: Run adapter and full tests**

Run:

```bash
pytest tests/test_cloud_adapters.py -q
pytest -q
```

- [x] **Step 6: Commit Firestore adapters**

```bash
git add shared/key_store.py shared/resolution_store.py tests/test_cloud_adapters.py
git commit -m "feat: implement Firestore edge stores"
```

---

## Task 2: Bounded key cache and fail-fast settings

**Files:**
- Create: `tardis-edge/tests/test_settings.py`
- Modify: `tardis-edge/shared/key_store.py`
- Modify: `tardis-edge/shared/settings.py`
- Modify: `tardis-edge/shared/__init__.py`

- [x] **Step 1: Add failing cache tests**

Add a `CountingKeyStore` and controllable clock to `tests/test_cloud_adapters.py` and cover:

```python
def test_key_cache_hits_then_refreshes_after_ttl():
    now = [100.0]
    source = CountingKeyStore(record)
    cache = CachingKeyStore(source, ttl_seconds=30, clock=lambda: now[0])
    assert cache.get(record.key) == record
    assert cache.get(record.key) == record
    assert source.calls == 1
    now[0] += 31
    assert cache.get(record.key) == record
    assert source.calls == 2


def test_key_cache_can_be_explicitly_invalidated():
    cache.get(record.key)
    cache.invalidate(record.key)
    cache.get(record.key)
    assert source.calls == 2


def test_key_cache_rejects_ttl_over_five_minutes():
    with pytest.raises(ValueError):
        CachingKeyStore(source, ttl_seconds=301)
```

- [x] **Step 2: Add failing settings tests**

In `tests/test_settings.py`, clear the relevant environment for every test and cover:

- development defaults to in-memory adapters;
- `TARDIS_ENV=production` defaults to Firestore/Pub/Sub and raises without `GCP_PROJECT`;
- unknown environment/backend values raise clearly;
- a Firestore key store is wrapped in `CachingKeyStore` with `KEY_CACHE_TTL_SECONDS`;
- malformed JSON or invalid resolution seed fails clearly instead of silently falling back.

- [x] **Step 3: Run tests and confirm failures**

Run: `pytest tests/test_cloud_adapters.py tests/test_settings.py -q`

- [x] **Step 4: Implement `CachingKeyStore`**

In `shared/key_store.py`, add a thread-safe cache wrapper using `time.monotonic`, a lock, and entries shaped as `(expires_at, Optional[KeyRecord])`. Cache both hits and misses for the configured TTL, bound the TTL to `0..300`, and expose `invalidate(key: Optional[str] = None)`.

Export it from `shared/__init__.py`.

- [x] **Step 5: Make settings explicit and production-safe**

In `shared/settings.py`:

- Accept `TARDIS_ENV=development|test|production`, defaulting to development.
- Default production resolution/key backends to Firestore and the event sink to Pub/Sub; keep memory defaults outside production.
- Reject unknown backend values.
- Require a non-empty GCP project through adapter constructors.
- Parse/cache TTL with a clear error and upper bound.
- Raise descriptive `ValueError`s for invalid local seed JSON/contracts.
- Keep cloud clients lazy: builder construction must not import `google.cloud`.

- [x] **Step 6: Run focused and full tests, then commit**

```bash
pytest tests/test_cloud_adapters.py tests/test_settings.py -q
pytest -q
git add shared/key_store.py shared/settings.py shared/__init__.py tests/test_cloud_adapters.py tests/test_settings.py
git commit -m "feat: fail fast on edge configuration"
```

---

## Task 3: Reliable Pub/Sub sink

**Files:**
- Modify: `tardis-edge/shared/event_sink.py`
- Modify: `tardis-edge/tests/test_cloud_adapters.py`

- [x] **Step 1: Add failing fake-publisher tests**

Cover:

- constructor rejects blank project/topic and non-positive publish timeout;
- topic path is `projects/{project}/topics/{topic}`;
- UTF-8 JSON exactly represents `AttributedAnalyticsEvent.to_dict()`;
- publish attributes include `schemaVersion="1"` and `eventType`;
- `future.result(timeout=...)` is invoked so Cloud Run does not terminate the request before the batch is accepted;
- publisher exceptions propagate to the collector seam, where they are deliberately swallowed.

- [x] **Step 2: Run and confirm failure**

Run: `pytest tests/test_cloud_adapters.py -q`

- [x] **Step 3: Implement the sink**

Change `EventSink`/`LocalInMemorySink` to hold `AttributedAnalyticsEvent`. Accept an optional injected publisher in `PubSubSink`, keep the real import lazy, serialize deterministic compact JSON, publish to the computed topic, and wait for bounded acceptance with `PUBSUB_PUBLISH_TIMEOUT_SECONDS` (default 5 seconds).

- [x] **Step 4: Run and commit**

```bash
pytest tests/test_cloud_adapters.py -q
pytest -q
git add shared/event_sink.py tests/test_cloud_adapters.py
git commit -m "feat: publish attributed analytics to Pub/Sub"
```

---

## Task 4: Authenticate and enrich collector events

**Files:**
- Modify: `tardis-edge/shared/contracts.py`
- Modify: `tardis-edge/shared/__init__.py`
- Modify: `tardis-edge/resolver/main.py`
- Modify: `tardis-edge/collector/main.py`
- Modify: `tardis-edge/tests/test_contracts.py`
- Modify: `tardis-edge/tests/test_resolver.py`
- Modify: `tardis-edge/tests/test_collector.py`

- [x] **Step 1: Add failing collector security/attribution tests**

Update the collector test fixture to inject both a sink and a `LocalInMemoryKeyStore`. Every valid client payload includes a UUID `eventId` and every valid browser request includes an allowed `Origin`.

Add assertions that:

- emitted records use `orgId` from the key store and `origin` from the request;
- client-supplied `orgId`/`origin` are ignored;
- missing/invalid UUID, unknown key, secret key, absent origin, and disallowed origin are dropped;
- wildcard subdomains work exactly as in resolver tests;
- key-store and sink failures still return the same `202 {"ok": true}` response;
- semantic rejection does not disclose whether a key exists;
- size and malformed-JSON guardrails remain 413/400.

- [x] **Step 2: Add failing shared-origin tests**

Move referer-to-origin/effective-origin handling into the shared contract module, export it, and add tests for malformed referers, exact Origin preference, scheme/host/port normalization, and query/path stripping. Update resolver tests so both services consume the same helper.

- [x] **Step 3: Run tests and confirm failure**

Run: `pytest tests/test_contracts.py tests/test_collector.py tests/test_resolver.py -q`

- [x] **Step 4: Implement strict client event parsing**

Extend `AnalyticsEvent` with required `eventId`, validate it as a UUID, require finite timestamps, strip/limit strings, and leave `AttributedAnalyticsEvent` as the only sink type.

- [x] **Step 5: Implement collector key/origin enforcement**

Change `create_app` to accept/build a `KeyStore`. For each client event:

1. parse the client-owned fields;
2. fetch the requested key;
3. require a publishable record;
4. derive and validate the effective browser origin;
5. apply shared `origin_allowed`;
6. construct a new `AttributedAnalyticsEvent` using server-owned `orgId` and origin;
7. emit it.

Keep `POST /collect` as a compatibility alias, but make `POST /events` canonical. For well-formed JSON, always return `202 {"ok": true}` regardless of accepted/dropped/sink outcome so key validity is not enumerable.

- [x] **Step 6: Run focused and full tests, then commit**

```bash
pytest tests/test_contracts.py tests/test_collector.py tests/test_resolver.py -q
pytest -q
git add shared/contracts.py shared/__init__.py resolver/main.py collector/main.py tests/test_contracts.py tests/test_collector.py tests/test_resolver.py
git commit -m "feat: attribute and authorize edge analytics"
```

---

## Task 5: Deployment contract and operator documentation

**Files:**
- Create: `tardis-edge/.env.example`
- Create: `tardis-edge/deploy/bigquery/ar-events-schema.json`
- Create: `tardis-edge/deploy/pubsub/ar-events-schema.avsc`
- Modify: `tardis-edge/README.md`
- Modify: `tardis-edge/CLAUDE.md`
- Modify: `tardis-edge/resolver/Dockerfile`
- Modify: `tardis-edge/collector/Dockerfile`

- [x] **Step 1: Add deployment configuration examples**

Document development defaults and production-required variables without secrets. Set `TARDIS_ENV=production` in both Cloud Run images so accidental in-memory deployment fails at startup.

- [x] **Step 2: Add event schemas**

Check in BigQuery and Pub/Sub schemas containing exactly:

`eventId`, `key`, `orgId`, `product`, `type`, `ts`, `origin`.

Make `eventId` the documented deduplication key and keep topic/table/subscription creation as deployment commands only.

- [x] **Step 3: Update README and maintainer guidance**

Remove every skeleton/unauthenticated-collector statement. Document canonical `/events`, key/origin enforcement, cache TTL, failure semantics, local commands with canonical fixtures, cloud roles, env validation, and deployment verification.

- [x] **Step 4: Verify container imports/config behavior**

Run:

```bash
TARDIS_ENV=production python -c 'import resolver.main'
TARDIS_ENV=production python -c 'import collector.main'
```

Expected: both fail clearly without `GCP_PROJECT`.

Then run with required cloud variables and confirm module import succeeds without creating a client or making a network call.

- [x] **Step 5: Commit deployment contract**

```bash
git add .env.example deploy README.md CLAUDE.md resolver/Dockerfile collector/Dockerfile
git commit -m "docs: add edge deployment contract"
```

---

## Task 6: Edge production completion gate

- [x] **Step 1: Run all tests and package checks**

```bash
pytest -q
python -m compileall -q shared resolver collector
python -m pip check
```

- [x] **Step 2: Build both containers when Docker is available**

```bash
docker build -f resolver/Dockerfile -t tardis-edge-resolver:test .
docker build -f collector/Dockerfile -t tardis-edge-collector:test .
```

If Docker is unavailable, record that as an environment limitation and at minimum verify Dockerfile parse/context inputs plus runtime imports.

- [x] **Step 3: Scan for remaining production skeletons and drift**

```bash
rg -n "SKELETON|TODO\(module-agent\)|NotImplementedError|collector does NOT authenticate" shared resolver collector README.md CLAUDE.md
git diff --check
git status --short --branch
```

Expected: no production skeletons, no whitespace errors, and a clean worktree containing only intentional commits.
