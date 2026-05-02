# AquaVeritas — Architecture & Design Decisions

> Full record of all locked decisions, explored options, and rationale.
> Written: 2026-05-02. Do not modify without updating the date and noting what changed.

---

## Project Identity

| Field | Value |
|---|---|
| Project name | AquaVeritas ("true water") |
| Hackathon | Hack #05: AI in Space — Liquid AI x DPhi Space |
| Track | Liquid Track (LFM2.5-VL required — $5k cash + $15k credits) |
| Core thesis | Freshwater bodies are shrinking and occasionally flooding due to climate change and human encroachment. On-board satellite inference detects and monitors both signals — water body status and surrounding agricultural stress — without downlinking raw imagery. |

---

## Problem Statement

Freshwater bodies (lakes, rivers) are simultaneously:

1. **Shrinking** — reduced by extraction, evaporation, sedimentation, and shoreline encroachment
2. **Flooding** — reduced basin capacity combined with extreme precipitation events causes overflow with less total water than historically required

The surrounding agricultural land reflects the same root stress: crop health degrades as water availability falls, and flooding damages harvests. A single satellite pass over a water body can diagnose both signals in one observation.

---

## D1 — Inference Call Strategy

**Decision: Two separate inference calls per location pass, results merged into one DB record.**

- Call 1: RGB-core + SWIR-core → water body JSON (4 fields)
- Call 2: RGB-buffer + SWIR-buffer → agricultural JSON (6 fields)
- Both results merged into one composite observation row in Postgres

### Options explored

**Option A — Two separate calls (chosen)**
- Each call receives 2 images matching the model's training distribution
- Water body and agricultural zones have distinct visual vocabularies — separate prompts allow more precise system instructions per zone
- Fine-tuning training examples are unambiguous: each example is 2 images → 1 JSON output
- Consistent with the wildfire reference project pattern (validated)

**Option B — Single call with all 4 images**
- Simpler pipeline — one API call per location
- Rejected: LFM2.5-VL-450M is a 450M parameter model trained on 1–2 image inputs. Feeding 4 images risks attention dilution. Fine-tuning training examples become ambiguous (which images drove which output fields). No validation that this works at this model scale.

**Option C — Single call with 2 images (one per zone, RGB only)**
- Eliminates SWIR entirely, simpler fetching
- Rejected: loses the primary diagnostic signal. SWIR composite is what makes water extent and crop moisture stress visible in a single false-colour image. RGB alone cannot reliably distinguish stressed from healthy vegetation or detect water boundaries in cloudy/turbid conditions.

---

## D2 — Temporal Baseline Approach

**Decision: Model classifies current image state. Location context provided in system prompt. Temporal trend emerges from the observation time series in the database.**

### Options explored

**Option A — Current-state classification + system prompt context (chosen)**
- Model receives 2 images and a system prompt that includes: location name, known baseline period, and a brief description of expected normal state (e.g., "Lake Chad historically covered ~25,000 km² in the 1960s and has been in long-term decline")
- Model classifies what it currently sees: `shrinking | stable | flooded | recovering | dry`
- The trend (shrinking over months/years) is computed from the sequence of observations stored in Postgres and visualised in the Streamlit dashboard
- Keeps the 2-image input pattern consistent and simple
- Dashboard layer owns the trend analysis — clean separation of concerns

**Option B — Feed current image + historical reference image**
- Model receives 3 images: RGB-current, SWIR-current, SWIR-reference (from a known baseline year)
- Model directly outputs `change_vs_reference: significant_loss | moderate_loss | stable | expanding`
- Most powerful for direct temporal comparison — the model sees before and after
- Rejected for MVP: requires curating and storing a reference image per location (12 reference images to source and validate). Increases training data complexity — each example needs a matched reference image. Adds a third image to the input, which compounds the attention concerns from D1. Can be added in Phase 2 once the base model is validated.

**Option C — Compute NDWI numerically, pass value to model as text context**
- Pre-compute Normalized Difference Water Index from the raw band arrays (`return_type=array`)
- Include computed NDWI score and area estimate in the system prompt
- Rejected: introduces a separate computation layer before inference, which breaks the "on-board VLM sees images" model. The purpose of using a VLM is to avoid pre-processing. Also adds code complexity in the data pipeline. NDWI computation as a Phase 2 post-processing step (not model input) remains valid.

---

## D3 — Database

**Decision: PostgreSQL + PostGIS. Decimal degree coordinates (WGS84 / SRID 4326) are mandatory at every layer.**

### Options explored

**Option A — SQLite (wildfire reference pattern)**
- Zero setup — just a file
- `sqlite3.connect("aquaveritas.db")` — no connection management
- Used and validated by the wildfire reference project
- Rejected: AquaVeritas is a fundamentally geospatial project. SQLite has no spatial index, no geometry types, no metric distance functions. The polling trigger, footprint storage, and future water boundary area calculations all require PostGIS. SQLite would mean reimplementing spatial logic in Python that PostGIS handles natively and correctly.

**Option B — Postgres without PostGIS**
- Proper relational DB, good time-series queries, JSONB support
- Lower setup complexity than PostGIS
- Rejected: given the project is geospatial and Postgres is already being added to Docker Compose, the marginal cost of the PostGIS extension is near zero (`CREATE EXTENSION IF NOT EXISTS postgis;`). Not using it would mean writing Python Haversine for the polling trigger, losing spatial indexing on footprints, and closing off the water boundary polygon path entirely. PostGIS is the right tool.

**Option C — PostgreSQL + PostGIS (chosen)**
- One additional Docker service (`postgis/postgis:15-3.3`)
- Geometry columns on all entities — `POINT` for locations and satellite positions, `POLYGON` for tile footprints and water boundaries
- `lon`/`lat` decimal degree columns remain as source of truth; geometry is always derived from or paired with them
- `GENERATED ALWAYS AS` computed geometry from lon/lat where possible — no dual-entry inconsistency risk
- GIST spatial indexes on all geometry columns
- JSONB for raw model output — re-parseable if schema evolves
- Enables ST_DWithin polling trigger, footprint overlap queries, future ST_Area water extent measurement, ST_Difference shrinkage calculation

### Coordinates rule
Every entity that has a physical location stores `lon DOUBLE PRECISION` and `lat DOUBLE PRECISION` as explicit columns in decimal degrees. Geometry columns are derived from these, never the other way around. This ensures the data is readable without PostGIS and portable to any future system.

### Schema summary

**locations**
```
id TEXT PK | name | lon | lat (mandatory)
geom GEOMETRY(POINT,4326) — generated from lon/lat
water_boundary GEOMETRY(POLYGON,4326) — preloaded from HydroSHEDS / Natural Earth
agri_buffer GEOMETRY(POLYGON,4326) — ST_Buffer(geom::geography, 10000) at insert
description | baseline_date
```

**observations**
```
id SERIAL PK | location_id FK | observed_at TIMESTAMPTZ
sat_lon | sat_lat | sat_alt_km (all mandatory)
sat_geom GEOMETRY(POINT,4326) — generated
core_footprint GEOMETRY(POLYGON,4326) — from Sentinel footprint metadata
buffer_footprint GEOMETRY(POLYGON,4326)
water_extent_status | flood_risk | water_clarity | shoreline_encroachment
agriculture_present | crop_stress_level | crop_stress_type
cultivation_expanding | settlement_visible | bare_soil_expansion
image_quality_limited
model_output_core JSONB | model_output_buffer JSONB
rgb_core_path | swir_core_path | rgb_buffer_path | swir_buffer_path
```

---

## D4 — Polling Trigger Logic

**Decision: ST_DWithin 50km radius + 24-hour minimum gap between observations per location.**

```sql
SELECT l.id, l.lon, l.lat
FROM locations l
LEFT JOIN observations o
    ON o.location_id = l.id
    AND o.observed_at > NOW() - INTERVAL '24 hours'
WHERE ST_DWithin(
    l.geom::geography,
    ST_Point($sat_lon, $sat_lat)::geography,
    50000
)
AND o.id IS NULL;
```

### Options explored

**Option A — Distance threshold only**
- If satellite within N km, trigger inference
- Simple, matches wildfire reference pattern
- Rejected: without a time gap, a slow satellite pass over a location triggers 3–5 inferences within minutes of each other. These are near-identical images of the same state — wasted compute and noisy data. The time gap is essential.

**Option B — Distance + 24-hour minimum gap (chosen)**
- Only trigger if satellite is within 50km AND the location has not been observed in the past 24 hours
- One clean observation per orbital pass
- 24 hours is the right floor: Sentinel-2 revisit is 5 days, so no legitimate new data arrives faster than that
- Time gap check implemented as a PostGIS left-join query — no separate Python state tracking needed

**Option C — Distance + Sentinel revisit window (5 days)**
- Only trigger if 5+ days have passed since last observation
- More aligned with Sentinel's actual revisit frequency
- Rejected for MVP: too restrictive during initial data collection and testing. 24 hours allows more frequent observation during the demo without duplicate passes. Can be tightened in production.

### Trigger radius: 50km
- 10km: too tight — satellite orbital position telemetry has some drift and the buffer zone is itself 10km
- 50km: matches the scale of the larger water bodies (Lake Chad, Lake Victoria) and gives enough lead time to fetch images before the satellite moves off
- 100km+: too wide — could trigger on locations that are not meaningfully in view

---

## D5 — Training Data Window

**Decision: 2018-01-01 to 2024-12-01, monthly timesteps, 30-day search window per timestep.**

### Sentinel-2 data availability
- Sentinel-2A launched: June 2015. First systematic data: July 2015
- Sentinel-2B launched: March 2017. Full 5-day revisit constellation: mid-2017
- L2A atmospheric correction: retroactively applied but regional gaps exist pre-2018
- STAC catalog: Element84 Earth Search v1 (`https://earth-search.aws.element84.com/v1`), collection `sentinel-2-l2a`
- No hardcoded date limits in SimSat code — constraint is catalog availability only

### Options explored

**Option A — 2015 to present (maximum range)**
- Maximum training data volume
- Rejected: 2015–2017 has incomplete L2A processing in many regions, single-satellite 10-day revisit, and higher cloud contamination rates. Training on inconsistent early data introduces noise that degrades model quality. Not worth the marginal gain.

**Option B — 2017 to present**
- Full constellation from mid-2017
- Tempting — two more years of data
- Rejected: early 2017 L2A coverage still has regional gaps. The quality improvement from a clean 2018 start outweighs the quantity gain from including 2017.

**Option C — 2018-01-01 to 2024-12-01 (chosen)**
- Full constellation, reliable L2A globally, 7 years of data
- 84 monthly timesteps × 12 locations = 1,008 labelled training examples
- Captures all major documented stress events (see event table below)
- Test split: 2024-01-01 onwards (~12 months held out, ~144 examples)
- Training set: ~864 examples

**Option D — 2020 to present (COVID baseline)**
- Cleaner atmospheric data during COVID lockdown period (reduced pollution)
- Rejected: too short. 5 years captures fewer stress cycles. The pre-COVID period (2018–2019) contains important baseline "normal" states for several locations that are needed for contrast.

### Sampling strategy
- Monthly timesteps: balances coverage of seasonal variation against API call volume
- `window_seconds=2592000` (30 days): finds the clearest available image near each monthly point rather than requiring an exact date hit. Accounts for Sentinel's 5-day revisit and cloud cover variability
- Total API calls for dataset generation: 84 months × 12 locations × 2 zones × 2 band sets = **4,032 requests**
- Note: Sentinel API is slow. Batch generation should be parallelised and run as an overnight job

### Key events within training window
| Year | Event | Location |
|---|---|---|
| 2018–2019 | Aral East Basin near-total collapse | Aral Sea |
| 2019 | Severe seasonal low | Lake Chad |
| 2020 | Historic flooding (+1.2m above normal) | Lake Victoria |
| 2021 | Near-record volume low | Lake Urmia |
| 2022 | European mega-drought, Po River record low | Po Valley |
| 2022 | Lake dried again | Lake Titicaca area |
| 2023 | El Niño — East Africa flooding | Lake Turkana, Victoria |
| 2024 | Continued Sahel degradation | Lake Chad |

---

## D6 — Location Selection

**Decision: 12 water bodies — 5 chronic shrinkage, 3 flooding/seasonal, 4 mixed/agricultural.**

### Selection criteria
1. Documented change history — enough label signal across the 2018–2024 training window
2. Agricultural activity in the 10km buffer zone — supports the crop stress output fields
3. Geographic diversity — global scope for the demo narrative
4. Sentinel-2 land coverage — no open ocean locations
5. Active shoreline — tile centered on the zone of change, not geographic center

### Chronic shrinkage (5 locations)

| ID | Name | Lat | Lon | Story | Agricultural buffer |
|---|---|---|---|---|---|
| lake_chad | Lake Chad | 13.47°N | 14.00°E | Lost ~90% since 1963, 30M people dependent | Millet, sorghum, cotton |
| aral_sea | Aral Sea East Basin | 45.50°N | 59.60°E | Near-total collapse driven by cotton irrigation diversion | Cotton monoculture — the root cause |
| lake_urmia | Lake Urmia | 37.70°N | 45.50°E | ~80% volume loss, salt flat expansion | Wheat, orchards encroaching on shoreline |
| dead_sea | Dead Sea | 31.50°N | 35.50°E | ~1m drop per year, sinkhole formation | Date palms, potash agriculture |
| salton_sea | Salton Sea | 33.33°N | -115.85°W | US West water crisis, accelerating since 2003 | Imperial Valley — intensive irrigation |

### Flooding / extreme seasonal variation (3 locations)

| ID | Name | Lat | Lon | Story | Agricultural buffer |
|---|---|---|---|---|---|
| lake_victoria | Lake Victoria | -1.00°S | 33.00°E | 2020 historic flooding, rapid seasonal recession | Subsistence farming on lake margins |
| tonle_sap | Tonle Sap | 12.50°N | 104.00°E | 3× size variation seasonally, long-term shrinkage trend | Rice paddies — flood-pulse dependent |
| okavango | Okavango Delta | -19.30°S | 22.80°E | Seasonal flood pulse UNESCO site, inflow variation | Cattle farming in buffer zone |

### Mixed / agricultural signal focus (4 locations)

| ID | Name | Lat | Lon | Story | Agricultural buffer |
|---|---|---|---|---|---|
| po_valley | Po Valley | 45.00°N | 11.00°E | 2022 European mega-drought, river at record low | Most productive agricultural land in Europe |
| mekong_delta | Mekong Delta | 10.00°N | 105.80°E | Upstream dams + salinity intrusion + sea level rise | Rice farming — existential water dependency |
| lake_turkana | Lake Turkana | 3.60°N | 36.10°E | Gibe III dam reducing Omo River inflow | Pastoral + small-scale farming communities |
| lake_titicaca | Lake Titicaca | -15.90°S | -69.33°W | Andean climate change, declining levels | Quinoa, potato farming on margins |

### Locations considered and rejected

**Lake Mead (Nevada/Arizona, USA)**
- Dramatic bathtub ring shrinkage, heavily documented, high media profile
- Rejected: minimal agricultural buffer at the lake margin — mostly desert canyon and urban water infrastructure. Does not serve the crop stress output field. Can be added as a pure water body monitor in Phase 2.

**Lake Poopó (Bolivia)**
- Completely dried 2015, partially refilled, dried again 2022
- Rejected: current state is essentially static (empty/near-empty). Good as a single reference image but a temporal training series of an empty lake adds noise without adding label diversity. The dry state is already represented in other locations.

**Lake Baikal (Russia)**
- World's deepest lake, freshwater volume record
- Rejected: shrinkage is minimal in the training window. Agricultural activity in the buffer is limited. Low label diversity across 84 timesteps — most observations would be `stable` / `no stress`.

**Lake Balaton (Hungary)**
- European context, well-monitored
- Rejected: changes are subtle and within normal seasonal variation for the 2018–2024 window. Better locations represent the European context (Po Valley has stronger signal and clearer agricultural story).

**Rhine River (Germany/Netherlands)**
- 2022 drought severely impacted barge traffic
- Rejected: a river rather than a lake — the 5km and 10km tile approach is less well-suited to linear features. River width changes are harder for a VLM to classify than lake extent changes.

---

## D7 — Dashboards

**Decision: Two dashboards with split responsibilities.**

| Dashboard | Port | Stack | Role |
|---|---|---|---|
| SimSat | 8000 | Django + React + Cesium | Satellite position, live orbital track, raw imagery input |
| AquaVeritas | 8501 | Streamlit + pydeck + Plotly | Inference results, trend analysis, hypothesis proof |

### Options explored

**Option A — Extend SimSat dashboard only**
- Single URL for demo
- 3D Cesium globe already built — add water body markers
- Rejected: SimSat is a Django/React codebase. Adding AquaVeritas-specific panels (time-series charts, per-location trend analysis, dual-zone comparison) requires navigating the existing frontend architecture. Slower to build than Streamlit. Risk of breaking existing SimSat functionality. React iteration speed is significantly lower than Streamlit for data-heavy dashboards in a hackathon context.

**Option B — Streamlit only, replace SimSat view**
- Single stack to maintain
- Rejected: the 3D orbital globe in SimSat is a strong demo asset — it makes the "satellite passing over Lake Chad" moment visual and compelling. Rebuilding it in Streamlit/pydeck would cost time and produce an inferior result. SimSat's globe is already built; use it.

**Option C — Two dashboards, split by role (chosen)**
- SimSat owns: orbital position, raw imagery, the physical satellite story
- AquaVeritas Streamlit owns: inference results, trend charts, the intelligence story
- Demo flow: "Here's the satellite passing over Lake Chad [SimSat globe] — here's what our model inferred, and here's the 3-year trend [Streamlit]"
- The split makes the on-board inference value proposition explicit: satellite sees images, model produces insight, dashboard shows insight — not imagery
- Streamlit is already validated by the wildfire reference project for exactly this pattern

### AquaVeritas Streamlit views (planned)
- World map (pydeck): 12 water bodies colour-coded by current `water_extent_status`
- Per-location: `water_extent_status` time series (Plotly line chart, 2018–present)
- Per-location: `crop_stress_level` time series alongside water status
- Live feed panel: latest inference results per location with thumbnail images
- Summary panel: locations with sustained shrinkage signal (3+ consecutive `shrinking` observations)

---

## Imagery & Input Strategy (locked)

### Four images per location per inference pass

| Request | Bands | Size | Purpose |
|---|---|---|---|
| RGB core | `red, green, blue` | 5km | Water body visual context, shoreline, near-margin settlement |
| SWIR core | `swir16, nir, red` | 5km | Water extent detection, moisture stress at water margin |
| RGB buffer | `red, green, blue` | 10km | Agricultural land use, field patterns, roads, infrastructure |
| SWIR buffer | `swir16, nir, red` | 10km | Crop moisture stress, bare soil expansion, vegetation health |

Both zones centered on the water body's **active shoreline** (not geographic center for large bodies like Aral Sea and Lake Chad where the center is now bare land).

### Why SWIR composite (`swir16, nir, red`)
In this false-colour rendering:
- **Water** → dark/black (SWIR is strongly absorbed by water)
- **Healthy vegetation** → bright green (high NIR reflectance)
- **Stressed crops** → amber/yellow (reduced NIR, elevated SWIR)
- **Bare/dried soil** → magenta/pink (high SWIR and red, low NIR)
- **Severely stressed/dead vegetation** → red/brown

A single SWIR composite image captures both water extent and crop moisture stress simultaneously — this is why it is the primary diagnostic band combination for this project.

### Tile size decisions
- **5km core**: focused on the water body itself — shoreline, water clarity, near-margin encroachment. Same default as wildfire reference.
- **10km buffer**: extends 5km in each direction from the same center point. Captures the immediate agricultural ring, irrigation canals, and settlement patterns without diluting the signal with unrelated land use.
- **Not 20km+**: wider tiles introduce too much land use variation, higher cloud contamination probability, and dilute the model's attention on the relevant agricultural zone.

---

## Output Schema (locked)

### Water body (core zone) — 4 fields
```json
{
  "water_extent_status": "shrinking | stable | flooded | recovering | dry",
  "flood_risk": "none | elevated | active",
  "water_clarity": "clear | turbid | heavily_silted",
  "shoreline_encroachment": true
}
```

### Agricultural buffer (buffer zone) — 6 fields
```json
{
  "agriculture_present": true,
  "crop_stress_level": "none | low | moderate | severe",
  "crop_stress_type": "drought | flood_damage | none",
  "cultivation_expanding_toward_water": false,
  "settlement_visible": true,
  "bare_soil_expansion": false
}
```

### Composite record (merged, one row per location per pass) — 11 fields
All 10 fields above + `image_quality_limited: bool`

---

## ML Pipeline (locked)

Follows the wildfire-prevention reference project structure exactly:

| Stage | Script | What it does |
|---|---|---|
| 1 Data generation | `generate_samples.py` | Monthly timesteps × 12 locations × 2 zones, fetches 4 images, labels with Claude oracle |
| 2 Dataset push | `push_dataset_to_hf.py` | Uploads to HuggingFace as train/test splits |
| 3 Fine-tune | `leap-finetune` + Modal H100 | Full fine-tune, no LoRA, LFM2.5-VL-450M, 3 epochs |
| 4 Quantize | `quantize.py` | Backbone Q8_0 GGUF + mmproj F16 GGUF |
| 5 Deploy | `llama-server` | OpenAI-compatible endpoint at localhost |
| 6 Live loop | `predict.py` | SimSat polling → PostGIS trigger → 4 fetches → 2 inferences → merge → Postgres |

---

## File Structure (locked)

```
aquaveritas/
├── src/
│   └── aquaveritas/
│       ├── simsat.py        — SimSat API client (4-image fetch per location pass)
│       ├── locations.py     — 12 Location dataclasses with coords + baseline dates
│       ├── db.py            — PostGIS schema init, insert helpers, trigger query
│       ├── annotator.py     — Claude oracle labelling (dual-zone system prompts)
│       ├── evaluator.py     — Model evaluation + accuracy metrics
│       ├── live.py          — SimSat polling + PostGIS trigger check
│       └── regions.py       — Tile matching, footprint helpers
├── scripts/
│   ├── predict.py           — Live polling loop (CLI entry point)
│   ├── backfill.py          — Historical predictions for all locations
│   ├── generate_samples.py  — Dataset generation via Claude oracle
│   ├── evaluate.py          — Evaluation runner
│   └── push_dataset_to_hf.py
├── app/
│   └── app.py               — Streamlit dashboard (AquaVeritas)
└── configs/
    └── aquaveritas_finetune_modal.yaml
```

---

## Infrastructure (locked)

```yaml
# Addition to existing docker-compose.yaml
postgres:
  image: postgis/postgis:15-3.3
  environment:
    POSTGRES_DB: aquaveritas
    POSTGRES_USER: aqua
    POSTGRES_PASSWORD: veritas
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U aqua -d aquaveritas"]
    interval: 10s
    timeout: 5s
    retries: 5
```

---

## Decision Summary Table

| ID | Topic | Decision | Key rejected option | Rejection reason |
|---|---|---|---|---|
| D1 | Inference calls | 2 separate calls, merged record | 1 call with 4 images | 450M model attention dilution; ambiguous fine-tuning examples |
| D2 | Temporal baseline | Current-state classification + system prompt context | Current + reference image (3 inputs) | Requires curated reference images; 3-image input complexity; Phase 2 candidate |
| D3 | Database | PostgreSQL + PostGIS, decimal degrees mandatory | SQLite | No spatial types, no metric distance, no geometry for future water boundary polygons |
| D4 | Polling trigger | ST_DWithin 50km + 24h gap | Distance only | Duplicate inferences per orbital pass without time gap |
| D5 | Training window | 2018-01-01 to 2024-12-01, monthly, 30-day window | 2015 to present | Pre-2018 L2A coverage gaps and single-satellite 10-day revisit add noise |
| D6 | Locations | 12 water bodies (5 shrinking, 3 flooding, 4 mixed) | Lake Mead, Poopó, Baikal, Balaton, Rhine | Insufficient agricultural buffer, static state, or low label diversity |
| D7 | Dashboards | SimSat (input) + AquaVeritas Streamlit (output) | Extend SimSat only | React iteration speed; risk to existing codebase; Streamlit validated by reference |
