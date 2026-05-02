# AquaVeritas — Product Requirements Document

| Field | Value |
|---|---|
| Version | 1.0 |
| Date | 2026-05-02 |
| Author | Leks / ML_LABS |
| Status | Approved — ready for implementation |
| Decisions ref | `docs/aquaveritas-decisions.md` |

---

## 1. Overview

AquaVeritas is an on-board satellite intelligence system that monitors the health of the world's freshwater bodies and the agricultural land surrounding them. A fine-tuned 450M-parameter vision-language model runs directly on the satellite, analyses multispectral imagery of 12 monitored water bodies, and downlinks only a compact 11-field JSON payload per observation — eliminating the need to transmit raw imagery to the ground.

Built for the Hack #05: AI in Space hackathon (Liquid AI × DPhi Space, Liquid Track), AquaVeritas demonstrates that domain-specific on-board AI can deliver actionable environmental intelligence at a fraction of the bandwidth cost of traditional Earth observation workflows.

---

## 2. Problem Statement

### 2.1 The freshwater paradox

Freshwater bodies — lakes, rivers, and inland seas — are experiencing two simultaneous and apparently contradictory stresses:

**Shrinkage:** Driven by agricultural water extraction, rising evaporation rates, reduced precipitation, and human encroachment on shorelines, many of the world's major freshwater bodies have lost 30–90% of their volume within living memory. Lake Chad has shrunk by ~90% since the 1960s. The Aral Sea's eastern basin is now effectively a desert. Lake Urmia has lost ~80% of its volume.

**Flooding:** Paradoxically, these same degraded basins are increasingly prone to flooding. Reduced natural basin capacity, hardened surrounding terrain from agricultural and urban development, and episodic extreme precipitation events combine to produce overflow events with less total water than was historically required to flood.

### 2.2 The agricultural connection

The communities and croplands surrounding these water bodies are caught in the same stress cycle. As water availability declines, crop stress increases. As floods occur, harvests are damaged. The agricultural buffer zone around a water body is both a symptom of the problem (irrigation extraction, shoreline encroachment) and a victim of it (drought stress, flood damage). The two signals — water body status and agricultural health — share the same root cause and must be monitored together.

### 2.3 The bandwidth problem

Sentinel-2 produces ~1.6 TB of imagery per day globally. Downlinking raw images from every pass over every monitored water body is impractical. The bottleneck is not sensing — it is transmission. On-board AI inference eliminates this bottleneck: the satellite processes what it sees and sends only the conclusion.

---

## 3. Goals

### 3.1 Primary goal
Demonstrate a complete end-to-end on-board AI inference pipeline for freshwater body and agricultural stress monitoring using the SimSat simulator, fine-tuned LFM2.5-VL-450M, and real Sentinel-2 imagery.

### 3.2 Hackathon success criteria
| Criterion | Target |
|---|---|
| Sentinel-2 imagery used via DPhi API | Yes — 4 images per location per pass |
| LFM2.5-VL model used (Liquid Track requirement) | Yes — LFM2.5-VL-450M fine-tuned |
| End-to-end demo runs without debugging | Yes — live polling loop + dashboard |
| Innovation and problem-solution alignment | Strong — freshwater paradox narrative |

### 3.3 Scientific hypothesis being tested
> Sentinel-2 multispectral imagery (RGB + SWIR composite) contains sufficient signal for a fine-tuned 450M vision-language model to accurately classify freshwater body stress status and surrounding agricultural health, enabling meaningful environmental monitoring at satellite inference speed and downlink bandwidth.

---

## 4. Users & Use Cases

### 4.1 Primary user (hackathon demo)
**Hackathon judges** evaluating technical implementation, innovation, and demo quality.

Demo flow:
1. SimSat dashboard (`localhost:8000`) shows satellite position orbiting Earth in real time
2. Satellite passes within 50km of Lake Chad
3. Inference triggers automatically — 4 images fetched, 2 model calls made
4. AquaVeritas dashboard (`localhost:8501`) updates: Lake Chad status `shrinking`, crop stress `moderate`, cultivation expanding toward water `true`
5. Trend chart shows water extent status deteriorating over the 2018–2024 training period

### 4.2 Secondary users (post-hackathon potential)
- Environmental agencies monitoring freshwater security
- Agricultural insurers assessing drought and flood exposure
- NGOs tracking water access for dependent populations
- Climate researchers validating remote sensing models

---

## 5. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  SATELLITE (simulated by SimSat)                                 │
│                                                                  │
│  predict.py  ──polling──►  SimSat API (localhost:9005)           │
│       │                        │                                 │
│       │                   position + 4 images                    │
│       │                   (RGB 5km, SWIR 5km,                    │
│       ▼                    RGB 10km, SWIR 10km)                  │
│  PostGIS trigger check                                           │
│  (ST_DWithin 50km + 24h gap)                                     │
│       │                                                          │
│       ▼                                                          │
│  llama-server  ◄── LFM2.5-VL-450M GGUF (fine-tuned)             │
│  Call 1: RGB-core + SWIR-core  → water body JSON                 │
│  Call 2: RGB-buffer + SWIR-buffer → agricultural JSON            │
│       │                                                          │
│       ▼                                                          │
│  Merge → Postgres + PostGIS (aquaveritas db)                     │
└──────────────────────────────┬───────────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
   SimSat Dashboard                  AquaVeritas Streamlit
   localhost:8000                    localhost:8501
   (orbital position,                (inference results,
    raw imagery input)                trend analysis,
                                      hypothesis proof)
```

---

## 6. Functional Requirements

### 6.1 SimSat API client (`src/aquaveritas/simsat.py`)

| ID | Requirement |
|---|---|
| F-1.1 | Fetch current satellite position: lon, lat, alt_km, timestamp |
| F-1.2 | Fetch RGB image (bands: red, green, blue) at a given lon/lat/timestamp for a given size_km |
| F-1.3 | Fetch SWIR composite image (bands: swir16, nir, red) at a given lon/lat/timestamp for a given size_km |
| F-1.4 | Parse and return Sentinel metadata: image_available, cloud_cover, datetime, footprint [lon_min, lat_min, lon_max, lat_max] |
| F-1.5 | Implement a `fetch_location_images(location, timestamp)` helper that returns all 4 images (RGB 5km, SWIR 5km, RGB 10km, SWIR 10km) and their metadata in a single call |
| F-1.6 | Handle `image_available: False` gracefully — return None for image, preserve metadata |
| F-1.7 | Use `window_seconds=2592000` (30 days) as default to maximise cloud-free image retrieval |

### 6.2 Location definitions (`src/aquaveritas/locations.py`)

| ID | Requirement |
|---|---|
| F-2.1 | Define a `Location` dataclass with fields: id, name, lon, lat, description, baseline_date, expected_water_status |
| F-2.2 | Instantiate all 12 monitored locations with coordinates in decimal degrees (WGS84) |
| F-2.3 | Tile centering: coordinates should point to the **active shoreline** of the water body, not its geographic center, for large bodies (Aral Sea, Lake Chad) |

**12 locations:**

| ID | Name | Lat | Lon | Category |
|---|---|---|---|---|
| lake_chad | Lake Chad | 13.47 | 14.00 | Shrinkage |
| aral_sea | Aral Sea East Basin | 45.50 | 59.60 | Shrinkage |
| lake_urmia | Lake Urmia | 37.70 | 45.50 | Shrinkage |
| dead_sea | Dead Sea | 31.50 | 35.50 | Shrinkage |
| salton_sea | Salton Sea | 33.33 | -115.85 | Shrinkage |
| lake_victoria | Lake Victoria | -1.00 | 33.00 | Flooding |
| tonle_sap | Tonle Sap | 12.50 | 104.00 | Flooding |
| okavango | Okavango Delta | -19.30 | 22.80 | Flooding |
| po_valley | Po Valley | 45.00 | 11.00 | Mixed/Agri |
| mekong_delta | Mekong Delta | 10.00 | 105.80 | Mixed/Agri |
| lake_turkana | Lake Turkana | 3.60 | 36.10 | Mixed/Agri |
| lake_titicaca | Lake Titicaca | -15.90 | -69.33 | Mixed/Agri |

### 6.3 Database (`src/aquaveritas/db.py`)

| ID | Requirement |
|---|---|
| F-3.1 | On startup, run `CREATE EXTENSION IF NOT EXISTS postgis` |
| F-3.2 | Create `locations` table with PostGIS geometry as specified in D3 schema |
| F-3.3 | Create `observations` table with PostGIS geometry as specified in D3 schema |
| F-3.4 | Populate `locations` table from `locations.py` on first run; populate `agri_buffer` as `ST_Buffer(geom::geography, 10000)::geometry` at insert |
| F-3.5 | Provide `insert_observation(location_id, observed_at, sat_lon, sat_lat, sat_alt_km, core_footprint, buffer_footprint, water_fields, agri_fields, image_paths, raw_outputs)` helper |
| F-3.6 | Provide `get_trigger_locations(sat_lon, sat_lat)` query: returns locations within 50km of satellite position that have no observation in the past 24 hours (PostGIS ST_DWithin + left-join time gap check) |
| F-3.7 | Provide `get_observations(location_id, start_date, end_date)` for dashboard time-series queries |
| F-3.8 | Store tile footprints using `ST_MakeEnvelope(lon_min, lat_min, lon_max, lat_max, 4326)` from Sentinel metadata |

### 6.4 Oracle annotator (`src/aquaveritas/annotator.py`)

| ID | Requirement |
|---|---|
| F-4.1 | Implement `annotate_core(rgb_bytes, swir_bytes, location)` — sends 2 images to Claude claude-opus-4-6, returns parsed water body JSON |
| F-4.2 | Implement `annotate_buffer(rgb_bytes, swir_bytes, location)` — sends 2 images to Claude claude-opus-4-6, returns parsed agricultural JSON |
| F-4.3 | System prompt for core call must include: role definition, location name and context, expected normal state description, output schema with all valid enum values, instruction to output only valid JSON |
| F-4.4 | System prompt for buffer call must include: role definition, location name and agricultural context, output schema, instruction to output only valid JSON |
| F-4.5 | Parse and validate JSON response; retry once on parse failure |
| F-4.6 | Return `None` for both JSON outputs if `image_quality_limited` is True (cloud cover >80% or image unavailable) |

**Core zone system prompt (template):**
```
You are an expert remote sensing analyst specialising in freshwater body monitoring.
You are analysing Sentinel-2 satellite imagery of {location.name} ({location.lat}°, {location.lon}°).
{location.description}
Baseline context: {location.expected_water_status}

You will receive two images:
1. RGB true-colour composite (red/green/blue bands)
2. SWIR false-colour composite (swir16/nir/red bands)
   - Dark/black areas = open water
   - Bright green = healthy vegetation
   - Amber/yellow = moderately stressed vegetation
   - Magenta/pink = bare or dried soil
   - Red/brown = severely stressed or dead vegetation

Analyse both images and return ONLY a JSON object with exactly these fields:
{
  "water_extent_status": "shrinking|stable|flooded|recovering|dry",
  "flood_risk": "none|elevated|active",
  "water_clarity": "clear|turbid|heavily_silted",
  "shoreline_encroachment": true|false,
  "image_quality_limited": true|false
}
```

**Buffer zone system prompt (template):**
```
You are an expert remote sensing analyst specialising in agricultural stress monitoring.
You are analysing Sentinel-2 satellite imagery of the agricultural zone surrounding {location.name}.
{location.description}

You will receive two images covering a 10km area:
1. RGB true-colour composite — shows field patterns, roads, settlements, land use
2. SWIR false-colour composite — shows crop moisture stress
   - Bright green = healthy, well-watered crops
   - Amber/yellow = moderate moisture stress
   - Magenta/pink = bare soil or harvest
   - Red/brown = severe stress or crop failure

Analyse both images and return ONLY a JSON object with exactly these fields:
{
  "agriculture_present": true|false,
  "crop_stress_level": "none|low|moderate|severe",
  "crop_stress_type": "drought|flood_damage|none",
  "cultivation_expanding_toward_water": true|false,
  "settlement_visible": true|false,
  "bare_soil_expansion": true|false,
  "image_quality_limited": true|false
}
```

### 6.5 Live polling loop (`scripts/predict.py`)

| ID | Requirement |
|---|---|
| F-5.1 | Poll `GET /data/current/position` at configurable interval (default: 30s) |
| F-5.2 | On each tick, call `db.get_trigger_locations(sat_lon, sat_lat)` — if no locations returned, sleep and continue |
| F-5.3 | For each triggered location: fetch all 4 images via `simsat.fetch_location_images()` |
| F-5.4 | Skip location if both core images are unavailable (`image_available: False`) |
| F-5.5 | Call llama-server for core zone (Call 1), then buffer zone (Call 2) |
| F-5.6 | Merge outputs into single observation record; insert into Postgres |
| F-5.7 | Save all 4 images to disk at `data/images/{location_id}/{timestamp}/` |
| F-5.8 | Log each observation to stdout: location, timestamp, water_extent_status, crop_stress_level |
| F-5.9 | CLI args: `--interval` (poll seconds), `--model-url` (llama-server endpoint), `--db-url` (Postgres connection string) |

### 6.6 Dataset generation (`scripts/generate_samples.py`)

| ID | Requirement |
|---|---|
| F-6.1 | For each of 12 locations, iterate monthly timesteps from 2018-01-01 to 2024-12-01 (84 timesteps) |
| F-6.2 | For each timestep, fetch 4 images via SimSat API using the static endpoint (`/data/image/sentinel`) |
| F-6.3 | Label each observation using `annotator.annotate_core()` and `annotator.annotate_buffer()` (Claude oracle) |
| F-6.4 | Skip timesteps where both core images are unavailable; log skipped count per location |
| F-6.5 | Store labelled examples in Postgres with `observed_at` set to the timestep date |
| F-6.6 | Support resumption — check if a timestep already exists in DB before fetching |
| F-6.7 | Support parallelised fetching across locations (not within a single location to preserve rate limits) |
| F-6.8 | CLI args: `--start` (date), `--end` (date), `--location` (single location or `all`) |

### 6.7 Model evaluation (`scripts/evaluate.py`)

| ID | Requirement |
|---|---|
| F-7.1 | Load test split (observations from 2024-01-01 onwards) from Postgres |
| F-7.2 | Run inference on each test example using either: Claude backend (oracle) or llama-server backend (LFM) |
| F-7.3 | Compute per-field accuracy for all 10 output fields |
| F-7.4 | Compute overall accuracy (mean across fields) |
| F-7.5 | Generate `report.md` with per-field breakdown, overall score, and per-location breakdown |
| F-7.6 | Save `results.json` with all predictions and ground truth for downstream analysis |

### 6.8 AquaVeritas Streamlit dashboard (`app/app.py`)

| ID | Requirement |
|---|---|
| F-8.1 | World map (pydeck): 12 water body markers colour-coded by most recent `water_extent_status` (shrinking=red, stable=yellow, flooded=blue, recovering=green, dry=grey) |
| F-8.2 | Location selector: click map marker or use dropdown to select a location |
| F-8.3 | Per-location water status panel: `water_extent_status` time series (Plotly line/scatter, 2018–present) |
| F-8.4 | Per-location crop stress panel: `crop_stress_level` mapped to numeric (none=0, low=1, moderate=2, severe=3), time series alongside water status |
| F-8.5 | Latest observation card: show most recent inference result for selected location with thumbnail images |
| F-8.6 | Summary panel: list locations with 3+ consecutive `shrinking` observations (the hypothesis proof) |
| F-8.7 | Auto-refresh every 60 seconds to pick up new live inferences |
| F-8.8 | Reads directly from Postgres — no intermediate API layer required |

---

## 7. ML Requirements

### 7.1 Base model
- **Model:** LFM2.5-VL-450M (Liquid AI)
- **Format for inference:** GGUF (backbone Q8_0 + mmproj F16)
- **Serving:** `llama-server` with OpenAI-compatible endpoint
- **Requirement:** Must use LFM2.5-VL or LFM2-VL (Liquid Track mandatory)

### 7.2 Training data specification

| Property | Value |
|---|---|
| Locations | 12 water bodies |
| Temporal range | 2018-01-01 to 2024-12-01 |
| Sampling | Monthly, 30-day search window per timestep |
| Total observations (target) | ~1,008 (some skipped for cloud cover / no image) |
| Train split | Before 2024-01-01 (~864 examples) |
| Test split | 2024-01-01 onwards (~144 examples) |
| Images per example | 2 (RGB + SWIR at the relevant zone) |
| Labels per example | JSON with 4 fields (core) or 6 fields (buffer) |
| Oracle | Claude claude-opus-4-6 via Anthropic API |

### 7.3 Training configuration

```yaml
# configs/aquaveritas_finetune_modal.yaml
model: liquid-ai/LFM2.5-VL-450M
dataset: {hf_username}/aquaveritas-water-stress
output_dir: aquaveritas-finetuned
num_epochs: 3
compute:
  provider: modal
  gpu: H100
  count: 1
finetune_type: full  # not LoRA — domain shift from standard pretraining
```

### 7.4 Model evaluation targets

| Field | Baseline (zero-shot) target | Fine-tuned target |
|---|---|---|
| water_extent_status | ~0.30 | ≥0.70 |
| flood_risk | ~0.40 | ≥0.75 |
| water_clarity | ~0.35 | ≥0.65 |
| shoreline_encroachment | ~0.45 | ≥0.75 |
| crop_stress_level | ~0.25 | ≥0.65 |
| crop_stress_type | ~0.30 | ≥0.65 |
| cultivation_expanding | ~0.40 | ≥0.70 |
| settlement_visible | ~0.55 | ≥0.80 |
| bare_soil_expansion | ~0.40 | ≥0.70 |
| agriculture_present | ~0.60 | ≥0.85 |
| **Overall** | **~0.40** | **≥0.72** |

Targets informed by the wildfire reference project baseline (0.38 → 0.84). Water/crop targets are slightly lower due to higher label complexity.

### 7.5 HuggingFace dataset structure

```
{hf_username}/aquaveritas-water-stress
├── train/
│   ├── metadata.parquet  (location_id, observed_at, zone, all label fields)
│   └── images/           (rgb_{id}.png, swir_{id}.png per example)
└── test/
    ├── metadata.parquet
    └── images/
```

---

## 8. Data Requirements

### 8.1 Sentinel-2 band requirements

| Band name | Sentinel-2 band | Wavelength | Use |
|---|---|---|---|
| `red` | B4 | 665nm | RGB composite, NDVI |
| `green` | B3 | 560nm | RGB composite |
| `blue` | B2 | 490nm | RGB composite |
| `nir` | B8 | 842nm | SWIR composite (vegetation health) |
| `swir16` | B11 | 1610nm | SWIR composite (moisture stress, water) |

### 8.2 Tile specifications

| Zone | size_km | Coverage | Purpose |
|---|---|---|---|
| Core | 5 | 25 km² | Water body, shoreline, near-margin |
| Buffer | 10 | 100 km² | Agricultural ring, irrigation, settlement |

Both tiles centered on the same coordinate (active shoreline).

### 8.3 Image quality handling

| Condition | Action |
|---|---|
| `image_available: False` | Skip zone; set `image_quality_limited: True` in record |
| `cloud_cover > 80%` | Flag `image_quality_limited: True`; still infer but lower confidence |
| Both zones unavailable | Skip entire observation; do not insert record |
| Core unavailable, buffer available | Insert record with water fields null; infer buffer only |

### 8.4 Temporal consistency note

Sentinel-2 divides its coverage into tiles. Images of the core (5km) and buffer (10km) zones at the same timestamp may be from different acquisition dates (the buffer zone edge may sit in an adjacent Sentinel tile with a different capture date). This is acceptable — the `datetime` field in the metadata captures the actual acquisition date per zone and is stored in the DB.

---

## 9. Infrastructure Requirements

### 9.1 Docker Compose services

| Service | Image | Port | Purpose |
|---|---|---|---|
| sim | (SimSat) | 9005 | Satellite orbit simulator + imagery API |
| dashboard | (SimSat) | 8000 | SimSat web dashboard |
| postgres | postgis/postgis:15-3.3 | 5432 | AquaVeritas database |

### 9.2 Additional runtime processes (not containerised for hackathon)

| Process | Command | Purpose |
|---|---|---|
| llama-server | `llama-server --model aquaveritas.gguf ...` | LFM inference endpoint |
| predict | `python scripts/predict.py` | Live polling loop |
| streamlit | `streamlit run app/app.py` | AquaVeritas dashboard |

### 9.3 Environment variables

| Variable | Description |
|---|---|
| `MAPBOX_ACCESS_TOKEN` | Mapbox API key (existing SimSat requirement) |
| `ANTHROPIC_API_KEY` | Claude oracle for dataset generation and evaluation |
| `DATABASE_URL` | `postgresql://aqua:<redacted>@localhost:5432/aquaveritas` |
| `SIMSAT_URL` | `http://localhost:9005` (default) |
| `LLAMA_SERVER_URL` | `http://localhost:8080` (default) |
| `HF_TOKEN` | HuggingFace token for dataset and model push/pull |

---

## 10. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | System must run end-to-end on a single developer machine (Docker Compose + local processes) |
| NFR-2 | Live inference latency: from satellite position poll to DB insert ≤ 120 seconds per location (accounting for Sentinel API slowness) |
| NFR-3 | Dashboard must refresh and show new data within 90 seconds of a new DB insert |
| NFR-4 | Dataset generation must be resumable — no re-fetching already-stored observations |
| NFR-5 | All coordinates stored as double precision decimal degrees; no DMS format anywhere in the codebase |
| NFR-6 | `image_quality_limited` must be set on every observation — no null quality flags |
| NFR-7 | llama-server must be running before `predict.py` is started — startup check required |
| NFR-8 | Demo must run without internet access to Anthropic API (inference uses local llama-server only) |

---

## 11. Implementation Milestones

| Milestone | Deliverables | Dependencies |
|---|---|---|
| **M1 — Foundation** | `locations.py`, `db.py` (schema + init), `simsat.py` (4-image fetch), Docker Compose + Postgres running | SimSat stack running |
| **M2 — Oracle pipeline** | `annotator.py`, `generate_samples.py`, first 100 labelled examples in DB | M1, Anthropic API key |
| **M3 — Full dataset** | All 1,008 examples generated, train/test split exported, pushed to HuggingFace | M2, full overnight run |
| **M4 — Fine-tuned model** | LFM2.5-VL-450M fine-tuned on Modal, GGUF quantized, pushed to HuggingFace, llama-server running locally | M3, Modal account |
| **M5 — Evaluation** | `evaluate.py` run against test split, `report.md` showing ≥0.72 overall accuracy | M4 |
| **M6 — Live loop** | `predict.py` running, triggering on monitored locations, inserting to Postgres | M4, SimSat running |
| **M7 — Dashboard** | Streamlit `app.py` running, world map, time-series charts, live feed panel | M6 |
| **M8 — Demo** | End-to-end demo recorded or live: SimSat globe → satellite pass → inference → Streamlit update | M7 |

---

## 12. Out of Scope (Phase 2)

The following are explicitly excluded from the hackathon MVP but are architected for:

| Feature | Why deferred | Architecture provision |
|---|---|---|
| NDWI/MNDWI numerical computation | Adds pre-processing layer; breaks pure VLM pattern | `return_type=array` endpoint available in SimSat |
| Water boundary polygon extraction | Requires raster-to-vector processing step | `water_boundary GEOMETRY(POLYGON)` column in DB schema |
| Water area measurement in km² | Depends on boundary polygons | `ST_Area(water_boundary::geography)/1e6` query ready |
| Temporal reference image comparison | Requires curated reference image per location | D2 decision — model architecture supports 3-image input |
| Real-time alerting (flood detected → notification) | Out of hackathon scope | Observation schema has `flood_risk` field ready |
| SAR (Synthetic Aperture Radar) imagery | Not available in SimSat | N/A |
| Additional water body locations | 12 locations sufficient for demo | `locations.py` is additive |

---

## 13. Dependencies & Risks

### 13.1 External dependencies

| Dependency | Risk | Mitigation |
|---|---|---|
| Sentinel-2 API (Element84 STAC) | Slow response times — dataset generation could take hours | Parallelise across locations; resume support in `generate_samples.py` |
| Sentinel-2 coverage | Some locations may have high cloud cover for certain months | 30-day window increases hit rate; skip and log rather than fail |
| Modal H100 availability | GPU slot not immediately available | Start fine-tuning early in the schedule |
| LFM2.5-VL GGUF availability | GGUF may need to be created from HuggingFace checkpoint | `quantize.py` script handles this; base checkpoint confirmed available |
| Anthropic API | Rate limits during dataset generation | Add sleep/retry in `annotator.py`; use batch processing |

### 13.2 Technical risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Fine-tuned model accuracy below 0.72 | Medium | High | Increase training epochs; add more augmentation locations; review label quality |
| Sentinel images unavailable for key locations in key years | Medium | Medium | 30-day window; skip + log; ensure train set has sufficient examples per location |
| Postgres/PostGIS Docker setup issues | Low | High | Test locally before dataset generation; have SQLite fallback script ready |
| llama-server performance too slow for live demo | Low | Medium | Pre-load model; reduce context length; demo with pre-recorded inference if necessary |
| SimSat satellite orbit never passes over target locations | Low | High | Use backfill endpoint (`/data/image/sentinel`) with fixed coordinates; not dependent on live orbital position for demo data |

---

## 14. Appendix: Output Schema Reference

### Core zone (water body)
```json
{
  "water_extent_status": "shrinking | stable | flooded | recovering | dry",
  "flood_risk": "none | elevated | active",
  "water_clarity": "clear | turbid | heavily_silted",
  "shoreline_encroachment": true | false,
  "image_quality_limited": true | false
}
```

### Buffer zone (agricultural)
```json
{
  "agriculture_present": true | false,
  "crop_stress_level": "none | low | moderate | severe",
  "crop_stress_type": "drought | flood_damage | none",
  "cultivation_expanding_toward_water": true | false,
  "settlement_visible": true | false,
  "bare_soil_expansion": true | false,
  "image_quality_limited": true | false
}
```

### Composite DB record (merged)
All fields from both zones. `image_quality_limited` stored once as the OR of both zone flags.

---

## 15. Appendix: SWIR Composite Visual Guide

The SWIR composite (`swir16, nir, red`) is the primary diagnostic image for this project. The following colour mappings guide both the oracle annotation and the fine-tuned model:

| Visual colour | Surface type | Relevance |
|---|---|---|
| Dark / black | Open water | Water extent — darker = deeper/cleaner |
| Navy blue | Shallow or turbid water | Sediment-laden or very shallow margins |
| Bright green | Healthy, well-watered vegetation | Irrigated crops, riparian vegetation |
| Amber / yellow | Moderate moisture stress | Early-stage crop drought stress |
| Magenta / pink | Bare soil, recently harvested, or dry | Expanding bare soil, shoreline recession |
| Deep red / brown | Severely stressed or dead vegetation | Late-stage drought, flood damage aftermath |
| White / pale | Cloud, salt flat, or very bright surface | Use `image_quality_limited: True` for clouds |
