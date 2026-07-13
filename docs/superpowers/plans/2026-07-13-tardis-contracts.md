# TARDIS Canonical Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one tested version-one contract for tenant keys, origin patterns, object/surface resolutions, and analytics records across backend, edge, embed, and admin.

**Architecture:** `furniture-web/contracts/v1` is the workspace reference fixture set; every contract-producing or contract-consuming repository carries an identical local copy so its CI can run independently. Python and TypeScript implementations retain separate source modules but must parse the same fixtures and expose the same public field names. A workspace verifier compares fixture bytes across sibling repositories.

**Tech Stack:** Python 3.11 dataclasses + pytest; TypeScript 5.6/5.7 strict mode; Node test runner + tsx; JSON fixtures; Node `crypto`/`fs` for workspace parity.

## Global Constraints

- Publishable keys start with `pk_`; secret keys start with `sk_`; malformed prefixes fail closed.
- Allowed origins are schemeful exact origins, explicit localhost origins, or schemeful wildcard subdomains such as `https://*.example.com`; global `*` remains dev-seed-only.
- Public resolutions use exactly `productId`, `name`, `mode`, `modelUrl`, `usdzUrl`, `posterUrl`, `surfaces`, and `defaultSurfaceId`.
- Firestore/store records retain `orgId`; public resolver responses omit it.
- Object mode requires at least one of `modelUrl` or `usdzUrl`.
- Surface mode requires a non-empty valid `surfaces` array and a `defaultSurfaceId` present in that array.
- Analytics records use `eventId`, `key`, `orgId`, `product`, `type`, `ts`, and `origin`; client events are represented separately until collector attribution lands.
- `tardis-embed` stays framework-free, strict TypeScript, fail-safe, and under the existing ~10 KB gzip loader budget.
- `tardis-edge` remains independent of Postgres and GPU/control-plane services.
- Do not weaken tenant isolation, auth-surface separation, resolver CORS/cache rules, or iframe/postMessage isolation.

---

## Task 1: Reference Fixtures and Workspace Parity Gate

**Files:**
- Create: `furniture-web/contracts/v1/key-record.valid.json`
- Create: `furniture-web/contracts/v1/resolution.object.valid.json`
- Create: `furniture-web/contracts/v1/resolution.surface.valid.json`
- Create: `furniture-web/contracts/v1/analytics-event.valid.json`
- Create: `furniture-web/contracts/v1/key-record.invalid-bare-origin.json`
- Create: `furniture-web/contracts/v1/resolution.object.invalid-no-assets.json`
- Create: `furniture-web/contracts/v1/resolution.surface.invalid-default.json`
- Create: `furniture-web/contracts/v1/analytics-event.invalid-type.json`
- Create identical files under: `tardis/contracts/v1/`, `tardis-edge/contracts/v1/`, `tardis-embed/contracts/v1/`, `tardis-admin/contracts/v1/`
- Create: `furniture-web/scripts/verify-workspace-contracts.mjs`
- Modify: `furniture-web/package.json`

**Interfaces:**
- Consumes: the field names and validation rules in the approved production-readiness spec.
- Produces: byte-identical fixture directories and `npm run contracts:verify`.

- [ ] **Step 1: Add the failing workspace verifier**

Create `furniture-web/scripts/verify-workspace-contracts.mjs`:

```js
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = resolve(repo, '..');
const canonical = join(repo, 'contracts', 'v1');
const consumers = ['tardis', 'tardis-edge', 'tardis-embed', 'tardis-admin'];
const files = [
  'key-record.valid.json',
  'resolution.object.valid.json',
  'resolution.surface.valid.json',
  'analytics-event.valid.json',
  'key-record.invalid-bare-origin.json',
  'resolution.object.invalid-no-assets.json',
  'resolution.surface.invalid-default.json',
  'analytics-event.invalid-type.json',
];

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const failures = [];
for (const file of files) {
  const expected = digest(join(canonical, file));
  for (const consumer of consumers) {
    const path = join(workspace, consumer, 'contracts', 'v1', file);
    let actual;
    try {
      actual = digest(path);
    } catch {
      failures.push(`${consumer}: missing contracts/v1/${file}`);
      continue;
    }
    if (actual !== expected) failures.push(`${consumer}: drifted contracts/v1/${file}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Verified ${files.length} contract fixtures across ${consumers.length} repositories.`);
```

Add to `furniture-web/package.json` scripts:

```json
"contracts:verify": "node scripts/verify-workspace-contracts.mjs"
```

- [ ] **Step 2: Run the verifier and confirm it fails**

Run: `cd furniture-web && npm run contracts:verify`

Expected: FAIL because `contracts/v1/key-record.valid.json` does not exist yet.

- [ ] **Step 3: Add the eight canonical fixtures**

`key-record.valid.json`:

```json
{
  "key": "pk_live_fixture",
  "orgId": "org_fixture",
  "allowedOrigins": [
    "https://shop.example.com",
    "https://*.preview.example.com",
    "http://localhost:3000"
  ]
}
```

`resolution.object.valid.json`:

```json
{
  "productId": "chair-001",
  "orgId": "org_fixture",
  "name": "Oak Lounge Chair",
  "mode": "object",
  "modelUrl": "https://cdn.example.com/org_fixture/chair-001/v1/model.glb",
  "usdzUrl": "https://cdn.example.com/org_fixture/chair-001/v1/model.usdz",
  "posterUrl": "https://cdn.example.com/org_fixture/chair-001/v1/poster.webp"
}
```

`resolution.surface.valid.json`:

```json
{
  "productId": "wallpaper-001",
  "orgId": "org_fixture",
  "name": "Sage Trellis Wallpaper",
  "mode": "surface",
  "posterUrl": "https://cdn.example.com/org_fixture/wallpaper-001/v1/poster.webp",
  "surfaces": [
    {
      "id": "sage",
      "label": "Sage",
      "kind": "pattern",
      "textureUrl": "https://cdn.example.com/org_fixture/wallpaper-001/v1/sage.png",
      "repeat": 6
    },
    {
      "id": "clay",
      "label": "Clay",
      "kind": "color",
      "color": "#c9b8a3"
    }
  ],
  "defaultSurfaceId": "sage"
}
```

`analytics-event.valid.json`:

```json
{
  "eventId": "8ea271d7-bad8-4e53-9bb8-5af52e329d23",
  "key": "pk_live_fixture",
  "orgId": "org_fixture",
  "product": "chair-001",
  "type": "ar_view",
  "ts": 1783936800.0,
  "origin": "https://shop.example.com"
}
```

`key-record.invalid-bare-origin.json`:

```json
{
  "key": "pk_live_fixture",
  "orgId": "org_fixture",
  "allowedOrigins": ["shop.example.com"]
}
```

`resolution.object.invalid-no-assets.json`:

```json
{
  "productId": "chair-001",
  "orgId": "org_fixture",
  "name": "Oak Lounge Chair",
  "mode": "object"
}
```

`resolution.surface.invalid-default.json`:

```json
{
  "productId": "wallpaper-001",
  "orgId": "org_fixture",
  "name": "Sage Trellis Wallpaper",
  "mode": "surface",
  "surfaces": [
    {"id": "sage", "label": "Sage", "kind": "color", "color": "#aabb99"}
  ],
  "defaultSurfaceId": "missing"
}
```

`analytics-event.invalid-type.json`:

```json
{
  "eventId": "8ea271d7-bad8-4e53-9bb8-5af52e329d23",
  "key": "pk_live_fixture",
  "orgId": "org_fixture",
  "product": "chair-001",
  "type": "click",
  "ts": 1783936800.0,
  "origin": "https://shop.example.com"
}
```

- [ ] **Step 4: Copy the exact fixture bytes into every consumer repository**

Create `contracts/v1` under `tardis`, `tardis-edge`, `tardis-embed`, and `tardis-admin`, with the eight files above byte-identical to `furniture-web/contracts/v1`.

- [ ] **Step 5: Run the parity gate**

Run: `cd furniture-web && npm run contracts:verify`

Expected: PASS with `Verified 8 contract fixtures across 4 repositories.`

- [ ] **Step 6: Commit fixture/parity changes in each repository**

Run:

```bash
cd furniture-web && git add package.json scripts/verify-workspace-contracts.mjs contracts/v1 && git commit -m "test: add canonical TARDIS contract fixtures"
cd ../tardis && git add contracts/v1 && git commit -m "test: add canonical TARDIS contract fixtures"
cd ../tardis-edge && git add contracts/v1 && git commit -m "test: add canonical TARDIS contract fixtures"
cd ../tardis-embed && git add contracts/v1 && git commit -m "test: add canonical TARDIS contract fixtures"
cd ../tardis-admin && git add contracts/v1 && git commit -m "test: add canonical TARDIS contract fixtures"
```

Expected: five commits, one per independent repository.

---

## Task 2: Backend Resolution and Origin Contract

**Files:**
- Create: `tardis/backend/tests/test_contracts_v1.py`
- Modify: `tardis/backend/app/edge_publish.py`
- Modify: `tardis/backend/app/tenants.py`
- Modify: `tardis/backend/app/routes/b2b.py`
- Modify: `tardis/backend/tests/test_b2b.py`

**Interfaces:**
- Consumes: local `tardis/contracts/v1/*.json` fixtures.
- Produces: `Resolution.from_dict`, `Resolution.to_dict`, `Resolution.to_public_dict`, `Resolution.validate`, `is_valid_origin_pattern`, and wildcard-aware `origin_allowed`.

- [ ] **Step 1: Write failing backend contract tests**

Create `backend/tests/test_contracts_v1.py`:

```python
import json
from pathlib import Path

import pytest

from app.edge_publish import Resolution
from app.tenants import KeyRecord, is_valid_origin_pattern, origin_allowed

FIXTURES = Path(__file__).resolve().parents[2] / "contracts" / "v1"


def fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def test_object_resolution_fixture_roundtrip():
    resolution = Resolution.from_dict(fixture("resolution.object.valid.json"))
    assert resolution.name == "Oak Lounge Chair"
    assert resolution.to_public_dict() == {
        key: value for key, value in fixture("resolution.object.valid.json").items()
        if key != "orgId"
    }


def test_surface_resolution_fixture_roundtrip():
    resolution = Resolution.from_dict(fixture("resolution.surface.valid.json"))
    assert resolution.defaultSurfaceId == "sage"
    assert resolution.surfaces[0]["textureUrl"].endswith("/sage.png")


@pytest.mark.parametrize(
    "name",
    ["resolution.object.invalid-no-assets.json", "resolution.surface.invalid-default.json"],
)
def test_invalid_resolution_fixtures_fail(name):
    with pytest.raises(ValueError):
        Resolution.from_dict(fixture(name))


def test_origin_patterns_are_schemeful_and_wildcard_aware():
    assert is_valid_origin_pattern("https://shop.example.com")
    assert is_valid_origin_pattern("https://*.preview.example.com")
    assert is_valid_origin_pattern("http://localhost:3000")
    assert not is_valid_origin_pattern("shop.example.com")
    assert not is_valid_origin_pattern("*")

    record = KeyRecord(
        key="pk_fixture",
        orgId="org_fixture",
        allowedOrigins=["https://*.preview.example.com"],
    )
    assert origin_allowed(record, "https://branch.preview.example.com")
    assert not origin_allowed(record, "https://preview.example.com")
    assert not origin_allowed(record, "https://branch.preview.example.com.evil.test")
```

- [ ] **Step 2: Run the backend contract tests and confirm failure**

Run: `cd tardis/backend && ./venv/bin/pytest tests/test_contracts_v1.py -q`

Expected: FAIL because `Resolution` has no `name`, `surfaces`, `defaultSurfaceId`, or `to_public_dict`, and `is_valid_origin_pattern` does not exist.

- [ ] **Step 3: Implement the canonical backend resolution**

In `backend/app/edge_publish.py`, replace the `Resolution` dataclass and update `on_generation_finished` to use the canonical names:

```python
@dataclass
class Resolution:
    productId: str
    name: str
    mode: ResolutionMode
    orgId: str = "org_unknown"
    modelUrl: Optional[str] = None
    usdzUrl: Optional[str] = None
    posterUrl: Optional[str] = None
    surfaces: Optional[list[dict[str, Any]]] = None
    defaultSurfaceId: Optional[str] = None

    def validate(self) -> "Resolution":
        if not self.productId.strip() or not self.name.strip():
            raise ValueError("productId and name are required")
        if self.mode == "object":
            if not (self.modelUrl or self.usdzUrl):
                raise ValueError("object resolution requires modelUrl or usdzUrl")
            if self.surfaces is not None or self.defaultSurfaceId is not None:
                raise ValueError("object resolution cannot carry surface fields")
            return self
        if self.mode != "surface":
            raise ValueError("mode must be object or surface")
        if not self.surfaces:
            raise ValueError("surface resolution requires surfaces")
        ids: set[str] = set()
        for swatch in self.surfaces:
            sid = str(swatch.get("id", "")).strip()
            label = str(swatch.get("label", "")).strip()
            kind = swatch.get("kind")
            if not sid or not label or sid in ids:
                raise ValueError("surface swatches require unique id and label")
            if kind == "pattern" and not str(swatch.get("textureUrl", "")).strip():
                raise ValueError("pattern swatch requires textureUrl")
            if kind == "color" and not str(swatch.get("color", "")).strip():
                raise ValueError("color swatch requires color")
            if kind not in ("pattern", "color"):
                raise ValueError("surface swatch kind must be pattern or color")
            ids.add(sid)
        if self.defaultSurfaceId not in ids:
            raise ValueError("defaultSurfaceId must reference a surface")
        if self.modelUrl is not None or self.usdzUrl is not None:
            raise ValueError("surface resolution cannot carry object model fields")
        return self

    def to_dict(self) -> dict:
        self.validate()
        return {key: value for key, value in asdict(self).items() if value is not None}

    def to_public_dict(self) -> dict:
        return {key: value for key, value in self.to_dict().items() if key != "orgId"}

    @staticmethod
    def from_dict(data: dict) -> "Resolution":
        return Resolution(
            productId=data["productId"],
            name=data["name"],
            mode=data["mode"],
            orgId=data.get("orgId", "org_unknown"),
            modelUrl=data.get("modelUrl"),
            usdzUrl=data.get("usdzUrl"),
            posterUrl=data.get("posterUrl"),
            surfaces=data.get("surfaces"),
            defaultSurfaceId=data.get("defaultSurfaceId"),
        ).validate()
```

Update `on_generation_finished` parameters and constructor:

```python
def on_generation_finished(
    *,
    product_id: str,
    name: str,
    org_id: str = "org_unknown",
    mode: ResolutionMode = "object",
    model_url: Optional[str] = None,
    usdz_url: Optional[str] = None,
    poster_url: Optional[str] = None,
    surfaces: Optional[list[dict[str, Any]]] = None,
    default_surface_id: Optional[str] = None,
    publisher: Optional[EdgePublisher] = None,
) -> Resolution:
    resolution = Resolution(
        productId=product_id,
        name=name,
        orgId=org_id,
        mode=mode,
        modelUrl=model_url,
        usdzUrl=usdz_url,
        posterUrl=poster_url,
        surfaces=surfaces,
        defaultSurfaceId=default_surface_id,
    ).validate()
    (publisher or get_publisher()).publish(resolution)
    return resolution
```

- [ ] **Step 4: Implement schemeful wildcard origin matching**

In `backend/app/tenants.py`, add:

```python
from urllib.parse import urlsplit


def is_valid_origin_pattern(pattern: str) -> bool:
    if pattern == "*" or not isinstance(pattern, str):
        return False
    parsed = urlsplit(pattern)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return False
    if parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password:
        return False
    host = parsed.hostname or ""
    if host.startswith("*."):
        host = host[2:]
        if not host or "*" in host:
            return False
    return bool(host) and "*" not in host


def _origin_matches(pattern: str, origin: str) -> bool:
    if pattern == "*":
        return True
    if not is_valid_origin_pattern(pattern):
        return False
    try:
        parsed_pattern = urlsplit(pattern)
        parsed_origin = urlsplit(origin)
        pattern_port = parsed_pattern.port
        origin_port = parsed_origin.port
    except ValueError:
        return False
    if parsed_origin.scheme != parsed_pattern.scheme or not parsed_origin.hostname:
        return False
    if parsed_origin.path or parsed_origin.query or parsed_origin.fragment:
        return False
    if origin_port != pattern_port:
        return False
    expected = parsed_pattern.hostname or ""
    actual = parsed_origin.hostname
    if expected.startswith("*."):
        suffix = expected[1:]
        return actual.endswith(suffix) and actual != expected[2:]
    return actual == expected


def origin_allowed(record: KeyRecord, origin: Optional[str]) -> bool:
    if record.kind == "secret":
        return True
    if not origin:
        return False
    return any(_origin_matches(pattern, origin) for pattern in record.allowedOrigins)
```

Keep `allowedOrigins == ["*"]` working only for the existing explicit dev seed through `_origin_matches`.

- [ ] **Step 5: Align the B2B response model and public serialization**

In `backend/app/routes/b2b.py`, make `ResolutionModel` canonical:

```python
class ResolutionModel(BaseModel):
    productId: str
    name: str
    mode: Literal["object", "surface"]
    modelUrl: Optional[str] = None
    usdzUrl: Optional[str] = None
    posterUrl: Optional[str] = None
    surfaces: Optional[list[dict]] = None
    defaultSurfaceId: Optional[str] = None
```

Return `ResolutionModel(**resolution.to_public_dict())` from resolve and build/publish `Resolution(...).validate()` using `name`, `surfaces`, and `defaultSurfaceId`.

In `backend/tests/test_b2b.py`, add these helpers below the origin constants and use them for every `/b2b/publish` body:

```python
def object_resolution(product_id: str, model_url: str = "https://cdn.example.com/model.glb") -> dict:
    return {
        "productId": product_id,
        "name": f"Product {product_id}",
        "mode": "object",
        "modelUrl": model_url,
    }


def surface_resolution(product_id: str) -> dict:
    return {
        "productId": product_id,
        "name": f"Surface {product_id}",
        "mode": "surface",
        "surfaces": [
            {"id": "wall", "label": "Wall", "kind": "color", "color": "#aabbcc"},
        ],
        "defaultSurfaceId": "wall",
    }
```

For cross-org overwrite coverage, construct the body explicitly from the helper so the untrusted field is still sent:

```python
body = {**object_resolution("chair-1", "https://evil.example/malicious.glb"), "orgId": "org_a"}
```

Replace each public organization assertion with:

```python
assert "orgId" not in response.json()
```

Change the local-publisher and `on_generation_finished` tests to pass `name`, canonical HTTPS object URLs, and this surface catalog:

```python
surfaces = [{"id": "wall", "label": "Wall", "kind": "color", "color": "#aabbcc"}]
```

- [ ] **Step 6: Run focused and full backend tests**

Run:

```bash
cd tardis/backend
./venv/bin/pytest tests/test_contracts_v1.py tests/test_b2b.py -q
./venv/bin/pytest tests -q
```

Expected: focused and full backend test directories PASS.

- [ ] **Step 7: Commit backend contract alignment**

```bash
cd tardis
git add backend/app/edge_publish.py backend/app/tenants.py backend/app/routes/b2b.py backend/tests/test_contracts_v1.py backend/tests/test_b2b.py
git commit -m "feat(backend): align B2B contracts"
```

---

## Task 3: Edge Resolution, Origin, and Attributed-Event Types

**Files:**
- Modify: `tardis-edge/shared/contracts.py`
- Modify: `tardis-edge/shared/__init__.py`
- Modify: `tardis-edge/resolver/main.py`
- Modify: `tardis-edge/tests/test_contracts.py`
- Modify: `tardis-edge/tests/test_resolver.py`

**Interfaces:**
- Consumes: local `tardis-edge/contracts/v1/*.json` fixtures.
- Produces: the same resolution/origin API as backend plus `AttributedAnalyticsEvent`, without yet changing collector delivery.

- [ ] **Step 1: Add failing fixture-driven edge tests**

Append to `tests/test_contracts.py`:

```python
import json
from pathlib import Path

from shared import AttributedAnalyticsEvent, is_valid_origin_pattern

FIXTURES = Path(__file__).resolve().parents[1] / "contracts" / "v1"


def fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def test_v1_object_and_surface_resolution_fixtures():
    object_resolution = Resolution.from_dict(fixture("resolution.object.valid.json"))
    surface_resolution = Resolution.from_dict(fixture("resolution.surface.valid.json"))
    assert "orgId" not in object_resolution.to_public_dict()
    assert surface_resolution.defaultSurfaceId == "sage"
    assert surface_resolution.surfaces[1]["color"] == "#c9b8a3"


@pytest.mark.parametrize(
    "name",
    ["resolution.object.invalid-no-assets.json", "resolution.surface.invalid-default.json"],
)
def test_v1_invalid_resolution_fixtures(name):
    with pytest.raises(ValueError):
        Resolution.from_dict(fixture(name))


def test_v1_attributed_analytics_fixture():
    event = AttributedAnalyticsEvent.from_dict(fixture("analytics-event.valid.json"))
    assert event.orgId == "org_fixture"
    assert event.origin == "https://shop.example.com"
    with pytest.raises(ValueError):
        AttributedAnalyticsEvent.from_dict(fixture("analytics-event.invalid-type.json"))


def test_v1_origin_pattern_validation():
    assert is_valid_origin_pattern("https://*.preview.example.com")
    assert not is_valid_origin_pattern("shop.example.com")
```

- [ ] **Step 2: Run the edge contract tests and confirm failure**

Run: `cd tardis-edge && .venv/bin/pytest tests/test_contracts.py -q`

Expected: FAIL because the canonical resolution fields, public serializer, attributed event, and origin validator do not exist.

- [ ] **Step 3: Implement the edge contract types**

In `shared/contracts.py`, replace `Resolution` with:

```python
@dataclass
class Resolution:
    productId: str
    name: str
    mode: ResolutionMode
    orgId: str = "org_unknown"
    modelUrl: Optional[str] = None
    usdzUrl: Optional[str] = None
    posterUrl: Optional[str] = None
    surfaces: Optional[list[dict[str, Any]]] = None
    defaultSurfaceId: Optional[str] = None

    def validate(self) -> "Resolution":
        if not self.productId.strip() or not self.name.strip():
            raise ValueError("productId and name are required")
        if self.mode == "object":
            if not (self.modelUrl or self.usdzUrl):
                raise ValueError("object resolution requires modelUrl or usdzUrl")
            if self.surfaces is not None or self.defaultSurfaceId is not None:
                raise ValueError("object resolution cannot carry surface fields")
            return self
        if self.mode != "surface":
            raise ValueError("mode must be object or surface")
        if not self.surfaces:
            raise ValueError("surface resolution requires surfaces")
        ids: set[str] = set()
        for swatch in self.surfaces:
            sid = str(swatch.get("id", "")).strip()
            label = str(swatch.get("label", "")).strip()
            kind = swatch.get("kind")
            if not sid or not label or sid in ids:
                raise ValueError("surface swatches require unique id and label")
            if kind == "pattern" and not str(swatch.get("textureUrl", "")).strip():
                raise ValueError("pattern swatch requires textureUrl")
            if kind == "color" and not str(swatch.get("color", "")).strip():
                raise ValueError("color swatch requires color")
            if kind not in ("pattern", "color"):
                raise ValueError("surface swatch kind must be pattern or color")
            ids.add(sid)
        if self.defaultSurfaceId not in ids:
            raise ValueError("defaultSurfaceId must reference a surface")
        if self.modelUrl is not None or self.usdzUrl is not None:
            raise ValueError("surface resolution cannot carry object model fields")
        return self

    def to_dict(self) -> dict:
        self.validate()
        return {key: value for key, value in asdict(self).items() if value is not None}

    def to_public_dict(self) -> dict:
        return {key: value for key, value in self.to_dict().items() if key != "orgId"}

    @staticmethod
    def from_dict(data: dict) -> "Resolution":
        return Resolution(
            productId=data["productId"],
            name=data["name"],
            mode=data["mode"],
            orgId=data.get("orgId", "org_unknown"),
            modelUrl=data.get("modelUrl"),
            usdzUrl=data.get("usdzUrl"),
            posterUrl=data.get("posterUrl"),
            surfaces=data.get("surfaces"),
            defaultSurfaceId=data.get("defaultSurfaceId"),
        ).validate()
```

Add this origin implementation (and `from urllib.parse import urlsplit`):

```python
def is_valid_origin_pattern(pattern: str) -> bool:
    if pattern == "*" or not isinstance(pattern, str):
        return False
    parsed = urlsplit(pattern)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return False
    if parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password:
        return False
    host = parsed.hostname or ""
    if host.startswith("*."):
        host = host[2:]
        if not host or "*" in host:
            return False
    return bool(host) and "*" not in host


def _origin_matches(pattern: str, origin: str) -> bool:
    if pattern == "*":
        return True
    if not is_valid_origin_pattern(pattern):
        return False
    try:
        parsed_pattern = urlsplit(pattern)
        parsed_origin = urlsplit(origin)
        pattern_port = parsed_pattern.port
        origin_port = parsed_origin.port
    except ValueError:
        return False
    if parsed_origin.scheme != parsed_pattern.scheme or not parsed_origin.hostname:
        return False
    if parsed_origin.path or parsed_origin.query or parsed_origin.fragment:
        return False
    if origin_port != pattern_port:
        return False
    expected = parsed_pattern.hostname or ""
    actual = parsed_origin.hostname
    if expected.startswith("*."):
        suffix = expected[1:]
        return actual.endswith(suffix) and actual != expected[2:]
    return actual == expected


def origin_allowed(record: KeyRecord, origin: Optional[str]) -> bool:
    if record.kind == "secret":
        return True
    if not origin:
        return False
    return any(_origin_matches(pattern, origin) for pattern in record.allowedOrigins)
```

Keep the existing client event compatible and add the enriched record:

```python
@dataclass
class AttributedAnalyticsEvent:
    eventId: str
    key: str
    orgId: str
    product: str
    type: EventType
    ts: float
    origin: str

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(data: dict) -> "AttributedAnalyticsEvent":
        if data.get("type") not in EVENT_TYPES:
            raise ValueError(f"invalid event type {data.get('type')!r}")
        required = ("eventId", "key", "orgId", "product", "origin")
        if any(not isinstance(data.get(field), str) or not data[field].strip() for field in required):
            raise ValueError("attributed analytics fields must be non-empty strings")
        return AttributedAnalyticsEvent(
            eventId=data["eventId"],
            key=data["key"],
            orgId=data["orgId"],
            product=data["product"],
            type=data["type"],
            ts=float(data["ts"]),
            origin=data["origin"],
        )
```

Export `AttributedAnalyticsEvent` and `is_valid_origin_pattern` from `shared/__init__.py`.

- [ ] **Step 4: Make resolver return only public fields**

In `resolver/main.py`, change the success response from `resolution.to_dict()` to:

```python
return JSONResponse(
    resolution.to_public_dict(),
    headers=_success_headers(origin),
)
```

Replace the `_client` resolution seed in `tests/test_resolver.py` with:

```python
Resolution(
    productId="sku-1",
    orgId="org_1",
    name="Fixture Chair",
    mode="object",
    usdzUrl="https://cdn.example.com/x.usdz",
    posterUrl="https://cdn.example.com/p.jpg",
),
```

In the response assertions use:

```python
assert "orgId" not in body
assert "surfaceCatalog" not in body
```

Replace the seeded surface JSON in `test_default_app_uses_seeded_dev_key` with:

```python
monkeypatch.setenv(
    "RESOLVER_SEED_RESOLUTIONS",
    '[{"productId":"seed-1","orgId":"org_dev","name":"Seed Surface",'
    '"mode":"surface","surfaces":[{"id":"seed","label":"Seed",'
    '"kind":"color","color":"#aabbcc"}],"defaultSurfaceId":"seed"}]',
)
```

- [ ] **Step 5: Run focused and full edge tests**

Run:

```bash
cd tardis-edge
.venv/bin/pytest tests/test_contracts.py tests/test_resolver.py -q
.venv/bin/pytest -q
```

Expected: all 43+ tests PASS with updated counts.

- [ ] **Step 6: Commit edge contract alignment**

```bash
cd tardis-edge
git add shared/contracts.py shared/__init__.py resolver/main.py tests/test_contracts.py tests/test_resolver.py
git commit -m "feat: align edge contracts"
```

---

## Task 4: Strict Embed Resolution Parser and Test Harness

**Files:**
- Create: `tardis-embed/src/shared/contract.ts`
- Create: `tardis-embed/src/shared/contract.test.ts`
- Modify: `tardis-embed/package.json`
- Modify: `tardis-embed/package-lock.json`
- Modify: `tardis-embed/tsconfig.json`

**Interfaces:**
- Consumes: `ProductResolution` and `SurfaceSwatch` from `src/shared/config.ts`, plus local fixtures.
- Produces: `parseProductResolution(value: unknown): ProductResolution`.

- [ ] **Step 1: Add the Node TypeScript test harness**

Run: `cd tardis-embed && npm install --save-dev tsx @types/node`

Set package scripts to include:

```json
"test": "node --import tsx --test src/shared/contract.test.ts"
```

Change `tsconfig.json` from `"types": []` to:

```json
"types": ["node"]
```

- [ ] **Step 2: Write the failing parser tests**

Create `src/shared/contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseProductResolution } from './contract.js';

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`../../contracts/v1/${name}`, import.meta.url), 'utf8'),
  );
}

test('parses canonical object and strips internal orgId', () => {
  const result = parseProductResolution(fixture('resolution.object.valid.json'));
  assert.equal(result.name, 'Oak Lounge Chair');
  assert.equal(result.modelUrl?.endsWith('/model.glb'), true);
  assert.equal('orgId' in result, false);
});

test('parses canonical surface catalog', () => {
  const result = parseProductResolution(fixture('resolution.surface.valid.json'));
  assert.equal(result.mode, 'surface');
  assert.equal(result.surfaces?.length, 2);
  assert.equal(result.defaultSurfaceId, 'sage');
});

for (const name of [
  'resolution.object.invalid-no-assets.json',
  'resolution.surface.invalid-default.json',
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => parseProductResolution(fixture(name)));
  });
}
```

- [ ] **Step 3: Run the embed test and confirm failure**

Run: `cd tardis-embed && npm test`

Expected: FAIL because `src/shared/contract.ts` does not exist.

- [ ] **Step 4: Implement strict parsing**

Create `src/shared/contract.ts`:

```ts
import type { ProductResolution, SurfaceSwatch } from './config.js';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('resolution must be an object');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, field);
}

function parseSwatch(value: unknown): SurfaceSwatch {
  const source = record(value);
  const id = requiredString(source['id'], 'surface.id');
  const label = requiredString(source['label'], 'surface.label');
  const kind = source['kind'];
  if (kind === 'pattern') {
    const textureUrl = requiredString(source['textureUrl'], 'surface.textureUrl');
    const thumbUrl = optionalString(source['thumbUrl'], 'surface.thumbUrl');
    const repeat = source['repeat'];
    if (repeat !== undefined && (typeof repeat !== 'number' || repeat <= 0)) {
      throw new TypeError('surface.repeat must be positive');
    }
    return {
      id,
      label,
      kind,
      textureUrl,
      ...(thumbUrl ? { thumbUrl } : {}),
      ...(typeof repeat === 'number' ? { repeat } : {}),
    };
  }
  if (kind === 'color') {
    const color = requiredString(source['color'], 'surface.color');
    const thumbUrl = optionalString(source['thumbUrl'], 'surface.thumbUrl');
    return { id, label, kind, color, ...(thumbUrl ? { thumbUrl } : {}) };
  }
  throw new TypeError('surface.kind must be pattern or color');
}

export function parseProductResolution(value: unknown): ProductResolution {
  const source = record(value);
  const productId = requiredString(source['productId'], 'productId');
  const name = requiredString(source['name'], 'name');
  const mode = source['mode'];
  const modelUrl = optionalString(source['modelUrl'], 'modelUrl');
  const usdzUrl = optionalString(source['usdzUrl'], 'usdzUrl');
  const posterUrl = optionalString(source['posterUrl'], 'posterUrl');

  if (mode === 'object') {
    if (!modelUrl && !usdzUrl) throw new TypeError('object resolution requires an asset');
    return {
      productId,
      name,
      mode,
      ...(modelUrl ? { modelUrl } : {}),
      ...(usdzUrl ? { usdzUrl } : {}),
      ...(posterUrl ? { posterUrl } : {}),
    };
  }
  if (mode !== 'surface') throw new TypeError('mode must be object or surface');
  if (modelUrl || usdzUrl) throw new TypeError('surface resolution cannot carry model assets');
  if (!Array.isArray(source['surfaces']) || source['surfaces'].length === 0) {
    throw new TypeError('surface resolution requires surfaces');
  }
  const surfaces = source['surfaces'].map(parseSwatch);
  const ids = new Set(surfaces.map((surface) => surface.id));
  if (ids.size !== surfaces.length) throw new TypeError('surface ids must be unique');
  const defaultSurfaceId = requiredString(source['defaultSurfaceId'], 'defaultSurfaceId');
  if (!ids.has(defaultSurfaceId)) throw new TypeError('defaultSurfaceId must reference a surface');
  return {
    productId,
    name,
    mode,
    ...(posterUrl ? { posterUrl } : {}),
    surfaces,
    defaultSurfaceId,
  };
}
```

- [ ] **Step 5: Run embed gates**

Run:

```bash
cd tardis-embed
npm test
npm run typecheck
npm run build
```

Expected: tests and typecheck PASS; build reports loader gzip below ~10 KB.

- [ ] **Step 6: Commit embed parser**

```bash
cd tardis-embed
git add package.json package-lock.json tsconfig.json src/shared/contract.ts src/shared/contract.test.ts
git commit -m "feat: validate canonical resolutions"
```

---

## Task 5: Admin Contract Module and Tests

**Files:**
- Create: `tardis-admin/src/lib/tardis-contracts.ts`
- Create: `tardis-admin/src/lib/tardis-contracts.test.ts`
- Modify: `tardis-admin/package.json`

**Interfaces:**
- Consumes: local canonical fixtures.
- Produces: admin-safe `ProductResolution`, `SurfaceSwatch`, `KeyRecord`, and parser/validator functions without `server-only` imports.

- [ ] **Step 1: Write failing admin contract tests**

Create `src/lib/tardis-contracts.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  isValidOriginPattern,
  parseKeyRecord,
  parseProductResolution,
} from "./tardis-contracts";

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`../../contracts/v1/${name}`, import.meta.url), "utf8"),
  );
}

test("parses canonical key and origins", () => {
  const key = parseKeyRecord(fixture("key-record.valid.json"));
  assert.equal(key.key, "pk_live_fixture");
  assert.equal(isValidOriginPattern(key.allowedOrigins[1]!), true);
  assert.throws(() => parseKeyRecord(fixture("key-record.invalid-bare-origin.json")));
});

test("parses object and surface fixtures", () => {
  assert.equal(parseProductResolution(fixture("resolution.object.valid.json")).mode, "object");
  assert.equal(parseProductResolution(fixture("resolution.surface.valid.json")).defaultSurfaceId, "sage");
});

test("rejects invalid resolution fixtures", () => {
  assert.throws(() => parseProductResolution(fixture("resolution.object.invalid-no-assets.json")));
  assert.throws(() => parseProductResolution(fixture("resolution.surface.invalid-default.json")));
});
```

Update the test script:

```json
"test": "node --import tsx --test src/lib/credits.test.ts src/lib/tardis-contracts.test.ts"
```

- [ ] **Step 2: Run admin tests and confirm failure**

Run: `cd tardis-admin && npm test`

Expected: FAIL because `tardis-contracts.ts` does not exist.

- [ ] **Step 3: Implement the admin contract module**

Create `src/lib/tardis-contracts.ts`:

```ts
export interface SurfaceSwatch {
  id: string;
  label: string;
  kind: "pattern" | "color";
  textureUrl?: string;
  color?: string;
  thumbUrl?: string;
  repeat?: number;
}

export interface ProductResolution {
  productId: string;
  name: string;
  mode: "object" | "surface";
  modelUrl?: string;
  usdzUrl?: string;
  posterUrl?: string;
  surfaces?: SurfaceSwatch[];
  defaultSurfaceId?: string;
}

export interface KeyRecord {
  key: string;
  orgId: string;
  allowedOrigins: string[];
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("contract value must be an object");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, field);
}

function parseSwatch(value: unknown): SurfaceSwatch {
  const source = record(value);
  const id = requiredString(source["id"], "surface.id");
  const label = requiredString(source["label"], "surface.label");
  const kind = source["kind"];
  if (kind === "pattern") {
    const textureUrl = requiredString(source["textureUrl"], "surface.textureUrl");
    const thumbUrl = optionalString(source["thumbUrl"], "surface.thumbUrl");
    const repeat = source["repeat"];
    if (repeat !== undefined && (typeof repeat !== "number" || repeat <= 0)) {
      throw new TypeError("surface.repeat must be positive");
    }
    return {
      id,
      label,
      kind,
      textureUrl,
      ...(thumbUrl ? { thumbUrl } : {}),
      ...(typeof repeat === "number" ? { repeat } : {}),
    };
  }
  if (kind === "color") {
    const color = requiredString(source["color"], "surface.color");
    const thumbUrl = optionalString(source["thumbUrl"], "surface.thumbUrl");
    return { id, label, kind, color, ...(thumbUrl ? { thumbUrl } : {}) };
  }
  throw new TypeError("surface.kind must be pattern or color");
}

export function parseProductResolution(value: unknown): ProductResolution {
  const source = record(value);
  const productId = requiredString(source["productId"], "productId");
  const name = requiredString(source["name"], "name");
  const mode = source["mode"];
  const modelUrl = optionalString(source["modelUrl"], "modelUrl");
  const usdzUrl = optionalString(source["usdzUrl"], "usdzUrl");
  const posterUrl = optionalString(source["posterUrl"], "posterUrl");

  if (mode === "object") {
    if (!modelUrl && !usdzUrl) throw new TypeError("object resolution requires an asset");
    return {
      productId,
      name,
      mode,
      ...(modelUrl ? { modelUrl } : {}),
      ...(usdzUrl ? { usdzUrl } : {}),
      ...(posterUrl ? { posterUrl } : {}),
    };
  }
  if (mode !== "surface") throw new TypeError("mode must be object or surface");
  if (modelUrl || usdzUrl) throw new TypeError("surface resolution cannot carry model assets");
  if (!Array.isArray(source["surfaces"]) || source["surfaces"].length === 0) {
    throw new TypeError("surface resolution requires surfaces");
  }
  const surfaces = source["surfaces"].map(parseSwatch);
  const ids = new Set(surfaces.map((surface) => surface.id));
  if (ids.size !== surfaces.length) throw new TypeError("surface ids must be unique");
  const defaultSurfaceId = requiredString(source["defaultSurfaceId"], "defaultSurfaceId");
  if (!ids.has(defaultSurfaceId)) throw new TypeError("defaultSurfaceId must reference a surface");
  return {
    productId,
    name,
    mode,
    ...(posterUrl ? { posterUrl } : {}),
    surfaces,
    defaultSurfaceId,
  };
}

export function isValidOriginPattern(pattern: string): boolean {
  if (pattern === "*") return false;
  try {
    const wildcard = pattern.includes("://*.");
    const candidate = wildcard ? pattern.replace("://*.", "://wildcard.") : pattern;
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return false;
    if (wildcard && !pattern.match(/^https?:\/\/\*\.[a-z0-9.-]+(?::\d+)?$/i)) return false;
    return true;
  } catch {
    return false;
  }
}

export function parseKeyRecord(value: unknown): KeyRecord {
  const source = record(value);
  const key = requiredString(source["key"], "key");
  const orgId = requiredString(source["orgId"], "orgId");
  if (!key.startsWith("pk_") && !key.startsWith("sk_")) {
    throw new TypeError("key must start with pk_ or sk_");
  }
  if (!Array.isArray(source["allowedOrigins"])) {
    throw new TypeError("allowedOrigins must be an array");
  }
  const allowedOrigins = source["allowedOrigins"].map((origin) => requiredString(origin, "origin"));
  if (allowedOrigins.some((origin) => !isValidOriginPattern(origin))) {
    throw new TypeError("allowedOrigins contains an invalid origin pattern");
  }
  return { key, orgId, allowedOrigins };
}
```

- [ ] **Step 4: Run admin gates**

Run:

```bash
cd tardis-admin
npm test
npm run lint
npm run build
```

Expected: tests, lint, and build PASS.

- [ ] **Step 5: Commit admin contract module**

```bash
cd tardis-admin
git add package.json src/lib/tardis-contracts.ts src/lib/tardis-contracts.test.ts
git commit -m "feat: add canonical TARDIS contracts"
```

---

## Task 6: Cross-Repository Contract Completion Gate

**Files:**
- Modify only if verification finds drift: contract fixture copies or contract tests from Tasks 1-5.

**Interfaces:**
- Consumes: all local fixture and parser/serializer gates.
- Produces: evidence that the first subproject is complete and safe for cloud/backend/admin/embed work.

- [ ] **Step 1: Run fixture parity**

Run: `cd furniture-web && npm run contracts:verify`

Expected: `Verified 8 contract fixtures across 4 repositories.`

- [ ] **Step 2: Run every affected contract gate**

Run:

```bash
cd tardis/backend && ./venv/bin/pytest tests -q
cd ../../tardis-edge && .venv/bin/pytest -q
cd ../tardis-embed && npm test && npm run typecheck && npm run build
cd ../tardis-admin && npm test && npm run lint && npm run build
```

Expected: every command exits 0; embed loader remains under the gzip budget.

- [ ] **Step 3: Check all affected worktrees**

Run:

```bash
git -C furniture-web status --short --branch
git -C tardis status --short --branch
git -C tardis-edge status --short --branch
git -C tardis-embed status --short --branch
git -C tardis-admin status --short --branch
```

Expected: clean worktrees, each ahead only by the intentional local commits.

- [ ] **Step 4: Record the gate result in the parent plan**

Mark Tasks 1-6 complete in this file, commit the checked boxes in `furniture-web`, and update the active execution plan to start the edge cloud-adapter subproject.

```bash
cd furniture-web
git add docs/superpowers/plans/2026-07-13-tardis-contracts.md
git commit -m "docs: complete canonical contracts plan"
```
