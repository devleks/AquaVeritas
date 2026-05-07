"""
AquaVeritas Streamlit Dashboard
---------------------------------
Three tabs:
  1. Global Monitor  — interactive globe + per-location time series
  2. Live Prediction — run a fresh inference against the current satellite pass
  3. Dataset         — browse and filter the full observation history

Run:
    streamlit run app/app.py
"""

import sys
from pathlib import Path

import pandas as pd
import plotly.express as px
import pydeck as pdk
import requests
import streamlit as st

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from aquaveritas.db import Database
from aquaveritas.locations import LOCATIONS, LOCATIONS_BY_ID
from aquaveritas.prose import (
    CLOUD_FRACTION_BLOCK,
    CLOUD_FRACTION_WARN,
    estimate_cloud_fraction,
    generate_prose,
)

# ── Config ────────────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="AquaVeritas",
    page_icon="💧",
    layout="wide",
)

SIMSAT_BASE      = "http://localhost:9005"
MODEL_URL        = "http://localhost:8080"
CORE_KM          = 15
BUFFER_KM        = 30

WATER_STATUS_COLOUR = {
    "shrinking":  [220, 50,  50,  200],
    "stable":     [250, 200, 50,  200],
    "flooded":    [30,  100, 200, 200],
    "recovering": [50,  180, 80,  200],
    "dry":        [160, 160, 160, 200],
    "unknown":    [100, 100, 100, 180],
}

STRESS_NUMERIC = {"none": 0, "low": 1, "moderate": 2, "severe": 3}
LOCATION_NAMES = {loc.id: loc.name for loc in LOCATIONS}

try:
    MAPBOX_TOKEN = st.secrets.get("MAPBOX_ACCESS_TOKEN", "")
except Exception:
    MAPBOX_TOKEN = ""

MAP_STYLE = (
    f"mapbox://styles/mapbox/dark-v10"
    if MAPBOX_TOKEN
    else "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
)

# ── Data loading ──────────────────────────────────────────────────────────────

@st.cache_data(ttl=60)
def load_all_observations():
    try:
        return Database().get_observations_for_dashboard()
    except Exception as exc:
        st.error(f"Database error: {exc}")
        return []


@st.cache_data(ttl=60)
def load_latest():
    try:
        return Database().get_latest_per_location()
    except Exception:
        return []


def to_df(rows: list[dict]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    if "observed_at" in df.columns:
        df["observed_at"] = pd.to_datetime(df["observed_at"], utc=True)
    return df


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sustained_shrinkage(df: pd.DataFrame, threshold: int = 3) -> list[tuple]:
    results = []
    for loc_id in df["location_id"].unique():
        sub = (
            df[df["location_id"] == loc_id]
            .sort_values("observed_at")["water_extent_status"]
            .tolist()
        )
        max_run = _max_consecutive(sub, "shrinking")
        if max_run >= threshold:
            results.append((loc_id, max_run))
    return sorted(results, key=lambda x: -x[1])


def _max_consecutive(values: list, target: str) -> int:
    max_run = current = 0
    for v in values:
        if str(v).lower() == target:
            current += 1
            max_run = max(max_run, current)
        else:
            current = 0
    return max_run


def _fetch_simsat_image(lat: float, lon: float, km: int, band: str) -> bytes | None:
    """Fetch a Sentinel-2 tile from SimSat API. Returns raw bytes or None."""
    half = km / 2
    deg  = half / 111.0
    bbox = f"{lon - deg},{lat - deg},{lon + deg},{lat + deg}"
    try:
        r = requests.get(
            f"{SIMSAT_BASE}/data/current/image/sentinel",
            params={"bbox": bbox, "band": band, "width": 512, "height": 512},
            timeout=30,
        )
        if r.ok and r.content:
            return r.content
    except Exception:
        pass
    try:
        r = requests.get(
            f"{SIMSAT_BASE}/data/image/sentinel",
            params={"bbox": bbox, "band": band, "width": 512, "height": 512},
            timeout=30,
        )
        if r.ok and r.content:
            return r.content
    except Exception:
        pass
    return None


def _run_vlm(image_bytes_list: list[bytes], system_prompt: str) -> dict | None:
    """Send images to llama-server and parse JSON response."""
    import base64, json, re

    images_payload = [
        {
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{base64.b64encode(b).decode()}"},
        }
        for b in image_bytes_list
        if b
    ]
    if not images_payload:
        return None

    payload = {
        "model": "aquaveritas",
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": images_payload
                + [{"type": "text", "text": "Analyse these satellite images and return the JSON assessment."}],
            },
        ],
        "temperature": 0.1,
        "max_tokens": 300,
    }

    try:
        r = requests.post(f"{MODEL_URL}/v1/chat/completions", json=payload, timeout=60)
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception:
        pass
    return None


# ── Load data ─────────────────────────────────────────────────────────────────

all_rows  = load_all_observations()
latest    = load_latest()
all_df    = to_df(all_rows)
latest_df = to_df(latest)
has_data  = not all_df.empty

# ── Header ────────────────────────────────────────────────────────────────────

st.markdown(
    "## AquaVeritas\n"
    "On-board satellite freshwater monitoring · "
    "Fine-tuned **LFM2.5-VL-450M** · 20 global sites"
)
st.divider()

# ── Tabs ──────────────────────────────────────────────────────────────────────

tab_globe, tab_predict, tab_data = st.tabs(
    ["Global Monitor", "Live Prediction", "Dataset"]
)

# ════════════════════════════════════════════════════════════════════════════
# TAB 1: Global Monitor
# ════════════════════════════════════════════════════════════════════════════

with tab_globe:
    col_controls, col_map = st.columns([1, 3])

    with col_controls:
        st.markdown("**Select site**")
        selected_id = st.selectbox(
            "Water body",
            options=list(LOCATION_NAMES.keys()),
            format_func=lambda x: LOCATION_NAMES[x],
            label_visibility="collapsed",
        )
        if st.button("Refresh data"):
            st.cache_data.clear()
            st.rerun()
        st.divider()
        st.metric("Total observations", len(all_df) if has_data else 0)
        st.metric("Sites monitored", len(LOCATIONS))
        st.divider()
        st.markdown("**Status legend**")
        for status, colour in WATER_STATUS_COLOUR.items():
            if status == "unknown":
                continue
            r, g, b, _ = colour
            st.markdown(
                f'<span style="color:rgb({r},{g},{b})">&#9679;</span> {status.capitalize()}',
                unsafe_allow_html=True,
            )
        st.divider()
        st.markdown("**Sustained shrinkage**")
        st.caption("3+ consecutive shrinking observations")
        if has_data:
            shrink_locs = _sustained_shrinkage(all_df)
            if shrink_locs:
                for loc_id, count in shrink_locs:
                    name = LOCATION_NAMES.get(loc_id, loc_id)
                    st.warning(f"**{name}** — {count} consecutive")
            else:
                st.success("None detected")
        else:
            st.info("No data yet")

    with col_map:
        st.markdown("**Global Water Body Status**")
        if not latest_df.empty:
            map_data = latest_df.copy()
            map_data["color"] = map_data["water_extent_status"].map(
                lambda s: WATER_STATUS_COLOUR.get(str(s).lower(), WATER_STATUS_COLOUR["unknown"])
            )
            map_data["tooltip"] = (
                map_data["location_name"] + "\n"
                + "Status: " + map_data["water_extent_status"].fillna("?") + "\n"
                + "Crop stress: " + map_data["crop_stress_level"].fillna("?")
            )
            layer = pdk.Layer(
                "ScatterplotLayer",
                data=map_data,
                get_position=["lon", "lat"],
                get_fill_color="color",
                get_radius=150_000,
                pickable=True,
                stroked=True,
                get_line_color=[255, 255, 255, 80],
                get_line_width=2,
            )
            view = pdk.ViewState(latitude=15, longitude=20, zoom=1.4, pitch=0)
            st.pydeck_chart(
                pdk.Deck(
                    layers=[layer],
                    initial_view_state=view,
                    tooltip={"text": "{tooltip}"},
                    map_style=MAP_STYLE,
                )
            )
        else:
            loc_df = pd.DataFrame([{"name": l.name, "lat": l.lat, "lon": l.lon} for l in LOCATIONS])
            layer  = pdk.Layer(
                "ScatterplotLayer",
                data=loc_df,
                get_position=["lon", "lat"],
                get_fill_color=[80, 140, 200, 160],
                get_radius=150_000,
                pickable=True,
            )
            view = pdk.ViewState(latitude=15, longitude=20, zoom=1.4)
            st.pydeck_chart(
                pdk.Deck(layers=[layer], initial_view_state=view, map_style=MAP_STYLE)
            )
            st.info("No observations yet. Run `scripts/predict.py` to generate data.")

    # Per-location detail
    st.divider()
    st.markdown(f"### {LOCATION_NAMES[selected_id]}")
    loc_df = all_df[all_df["location_id"] == selected_id] if has_data else pd.DataFrame()

    if loc_df.empty:
        st.info(f"No observations recorded for {LOCATION_NAMES[selected_id]}.")
    else:
        col_water, col_crop = st.columns(2)

        with col_water:
            st.markdown("**Water extent status over time**")
            water_order = ["flooded", "recovering", "stable", "shrinking", "dry"]
            fig = px.scatter(
                loc_df, x="observed_at", y="water_extent_status",
                color="flood_risk",
                color_discrete_map={"none": "#4CAF50", "elevated": "#FF9800", "active": "#F44336"},
                category_orders={"water_extent_status": water_order},
                labels={"observed_at": "Date", "water_extent_status": "Status"},
                height=280,
            )
            fig.update_traces(marker_size=9)
            fig.update_layout(margin=dict(l=0, r=0, t=10, b=0))
            st.plotly_chart(fig, use_container_width=True)

        with col_crop:
            st.markdown("**Crop stress level over time**")
            loc_df["stress_num"] = loc_df["crop_stress_level"].map(STRESS_NUMERIC)
            fig2 = px.scatter(
                loc_df.dropna(subset=["stress_num"]),
                x="observed_at", y="stress_num",
                color="crop_stress_type",
                color_discrete_map={"drought": "#FF6B35", "flood_damage": "#4FC3F7", "none": "#81C784"},
                labels={"observed_at": "Date", "stress_num": "Stress level"},
                height=280,
            )
            fig2.update_yaxes(tickvals=[0, 1, 2, 3], ticktext=["None", "Low", "Moderate", "Severe"])
            fig2.update_traces(marker_size=9)
            fig2.update_layout(margin=dict(l=0, r=0, t=10, b=0))
            st.plotly_chart(fig2, use_container_width=True)

        # Latest observation card
        st.markdown("**Latest observation**")
        latest_row = loc_df.sort_values("observed_at").iloc[-1]
        c1, c2, c3 = st.columns(3)

        with c1:
            st.metric("Water status",  str(latest_row.get("water_extent_status", "—")))
            st.metric("Flood risk",    str(latest_row.get("flood_risk", "—")))
            st.metric("Water clarity", str(latest_row.get("water_clarity", "—")))
        with c2:
            st.metric("Crop stress", str(latest_row.get("crop_stress_level", "—")))
            st.metric("Stress type", str(latest_row.get("crop_stress_type", "—")))
            enc = "Expanding" if latest_row.get("cultivation_expanding") else "Stable"
            st.metric("Cultivation", enc)
        with c3:
            ts = latest_row.get("observed_at")
            st.metric("Observed", str(ts)[:10] if ts else "—")
            quality_ok = not latest_row.get("image_quality_limited", False)
            st.metric("Image quality", "Good" if quality_ok else "Limited")

        img_path = latest_row.get("rgb_core_path")
        if img_path and Path(img_path).exists():
            st.image(img_path, caption="RGB core (15km)", use_column_width=True)

        prose = latest_row.get("prose_brief")
        if prose and str(prose).strip() and str(prose) != "None":
            st.divider()
            st.markdown("**Analyst Brief**")
            st.markdown(prose)


# ════════════════════════════════════════════════════════════════════════════
# TAB 2: Live Prediction
# ════════════════════════════════════════════════════════════════════════════

with tab_predict:
    st.markdown("### Live Prediction")
    st.caption(
        "Fetches current Sentinel-2 imagery from SimSat, runs the fine-tuned "
        "LFM2.5-VL-450M model, and generates an analyst brief via Claude Haiku."
    )

    lp_col1, lp_col2 = st.columns([2, 1])
    with lp_col1:
        predict_loc_id = st.selectbox(
            "Select water body",
            options=list(LOCATION_NAMES.keys()),
            format_func=lambda x: LOCATION_NAMES[x],
            key="predict_loc",
        )
    with lp_col2:
        st.markdown("")
        run_btn = st.button("Run Prediction", type="primary", use_container_width=True)

    if run_btn:
        loc = LOCATIONS_BY_ID[predict_loc_id]
        st.markdown(f"**{loc.name}** — {loc.lat:.3f}N, {loc.lon:.3f}E")

        with st.spinner("Fetching Sentinel-2 imagery..."):
            rgb_core   = _fetch_simsat_image(loc.lat, loc.lon, CORE_KM,   "rgb")
            swir_core  = _fetch_simsat_image(loc.lat, loc.lon, CORE_KM,   "swir")
            rgb_buf    = _fetch_simsat_image(loc.lat, loc.lon, BUFFER_KM,  "rgb")
            swir_buf   = _fetch_simsat_image(loc.lat, loc.lon, BUFFER_KM,  "swir")

        # Display tiles
        img_cols = st.columns(4)
        labels = ["Core RGB", "Core SWIR", "Buffer RGB", "Buffer SWIR"]
        tiles  = [rgb_core, swir_core, rgb_buf, swir_buf]
        for col, label, tile in zip(img_cols, labels, tiles):
            with col:
                if tile:
                    st.image(tile, caption=label, use_column_width=True)
                else:
                    st.warning(f"{label}: unavailable")

        # Cloud screening
        cloud_core = estimate_cloud_fraction(rgb_core) if rgb_core else 1.0
        cloud_buf  = estimate_cloud_fraction(rgb_buf)  if rgb_buf  else 1.0
        cloud_frac = max(cloud_core, cloud_buf)
        cloud_pct  = int(cloud_frac * 100)

        if cloud_frac >= CLOUD_FRACTION_BLOCK:
            st.error(f"Cloud cover {cloud_pct}% — imagery too degraded for reliable classification. Observation skipped.")
            st.stop()
        elif cloud_frac >= CLOUD_FRACTION_WARN:
            st.warning(f"Cloud cover {cloud_pct}% — classification is low-confidence. Assessment suppressed.")
            cloud_degraded = True
        else:
            st.success(f"Cloud cover {cloud_pct}% — clear for inference.")
            cloud_degraded = False

        # VLM inference
        from aquaveritas.annotator import CORE_SYSTEM, BUFFER_SYSTEM

        core_system = CORE_SYSTEM.format(
            name=loc.name, lat=loc.lat, lon=loc.lon,
            description=loc.description,
            expected_water_status=loc.expected_water_status,
        )
        buf_system = BUFFER_SYSTEM.format(
            name=loc.name, lat=loc.lat, lon=loc.lon,
            description=loc.description,
        )

        with st.spinner("Running VLM inference..."):
            core_result   = _run_vlm([rgb_core, swir_core], core_system)   if rgb_core  else None
            buffer_result = _run_vlm([rgb_buf,  swir_buf],  buf_system)    if rgb_buf   else None

        if core_result is None and buffer_result is None:
            st.error("Inference failed — is llama-server running on port 8080?")
            st.stop()

        # Structured fields
        st.divider()
        st.markdown("**Core zone (15km x 15km — water body)**")
        if core_result:
            cc = st.columns(5)
            cc[0].metric("Water status",   str(core_result.get("water_extent_status", "—")))
            cc[1].metric("Flood risk",     str(core_result.get("flood_risk", "—")))
            cc[2].metric("Clarity",        str(core_result.get("water_clarity", "—")))
            cc[3].metric("Shore encroach", "Yes" if core_result.get("shoreline_encroachment") else "No")
            cc[4].metric("Image quality",  "Limited" if core_result.get("image_quality_limited") else "Good")
        else:
            st.info("Core zone inference unavailable.")

        st.markdown("**Buffer zone (30km x 30km — agricultural area)**")
        if buffer_result:
            bc = st.columns(6)
            bc[0].metric("Agriculture",  "Present" if buffer_result.get("agriculture_present") else "Absent")
            bc[1].metric("Crop stress",  str(buffer_result.get("crop_stress_level", "—")))
            bc[2].metric("Stress type",  str(buffer_result.get("crop_stress_type", "—")))
            bc[3].metric("Cultivation",  "Expanding" if buffer_result.get("cultivation_expanding_toward_water") else "Stable")
            bc[4].metric("Settlement",   "Visible" if buffer_result.get("settlement_visible") else "None")
            bc[5].metric("Bare soil",    "Expanding" if buffer_result.get("bare_soil_expansion") else "Stable")
        else:
            st.info("Buffer zone inference unavailable.")

        # Prose brief
        st.divider()
        with st.spinner("Generating analyst brief..."):
            from datetime import datetime, timezone
            date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            prose = generate_prose(
                location=loc.name,
                date=date_str,
                core=core_result,
                buffer=buffer_result,
                cloud_degraded=cloud_degraded,
            )

        st.markdown("**Analyst Brief**")
        st.markdown(prose)


# ════════════════════════════════════════════════════════════════════════════
# TAB 3: Dataset
# ════════════════════════════════════════════════════════════════════════════

with tab_data:
    st.markdown("### Dataset")
    st.caption("All labeled observations from the AquaVeritas monitoring pipeline.")

    if not has_data:
        st.info("No observations in the database.")
    else:
        f1, f2, f3 = st.columns(3)
        with f1:
            site_filter = st.multiselect(
                "Site",
                options=sorted(all_df["location_name"].unique()),
                default=[],
                placeholder="All sites",
            )
        with f2:
            status_filter = st.multiselect(
                "Water status",
                options=sorted(all_df["water_extent_status"].dropna().unique()),
                default=[],
                placeholder="All statuses",
            )
        with f3:
            stress_filter = st.multiselect(
                "Crop stress",
                options=sorted(all_df["crop_stress_level"].dropna().unique()),
                default=[],
                placeholder="All levels",
            )

        filtered = all_df.copy()
        if site_filter:
            filtered = filtered[filtered["location_name"].isin(site_filter)]
        if status_filter:
            filtered = filtered[filtered["water_extent_status"].isin(status_filter)]
        if stress_filter:
            filtered = filtered[filtered["crop_stress_level"].isin(stress_filter)]

        st.markdown(f"**{len(filtered):,} observations**")

        display_cols = [
            "observed_at", "location_name", "category",
            "water_extent_status", "flood_risk", "water_clarity",
            "crop_stress_level", "crop_stress_type",
            "cultivation_expanding", "bare_soil_expansion",
            "image_quality_limited",
        ]
        st.dataframe(
            filtered[display_cols].sort_values("observed_at", ascending=False),
            use_container_width=True,
            height=500,
        )

        st.divider()
        col_s1, col_s2 = st.columns(2)

        with col_s1:
            st.markdown("**Water status distribution**")
            status_counts = (
                filtered["water_extent_status"]
                .value_counts()
                .reset_index()
            )
            fig_s = px.bar(
                status_counts,
                x="water_extent_status", y="count",
                color="water_extent_status",
                color_discrete_map={
                    "shrinking": "#DC3232", "stable": "#FAC832",
                    "flooded": "#1E64C8", "recovering": "#32B450", "dry": "#A0A0A0",
                },
                height=300,
                labels={"water_extent_status": "Status", "count": "Count"},
            )
            fig_s.update_layout(showlegend=False, margin=dict(l=0, r=0, t=10, b=0))
            st.plotly_chart(fig_s, use_container_width=True)

        with col_s2:
            st.markdown("**Observations per site**")
            site_counts = (
                filtered.groupby("location_name")
                .size()
                .reset_index(name="count")
                .sort_values("count", ascending=True)
            )
            fig_l = px.bar(
                site_counts, x="count", y="location_name", orientation="h",
                height=300,
                labels={"count": "Observations", "location_name": "Site"},
            )
            fig_l.update_layout(margin=dict(l=0, r=0, t=10, b=0))
            st.plotly_chart(fig_l, use_container_width=True)


# ── Footer ────────────────────────────────────────────────────────────────────

st.divider()
st.caption(
    "AquaVeritas · Fine-tuned LFM2.5-VL-450M via SimSat + Sentinel-2 · "
    "Accuracy: 38% (base) → 84% (fine-tuned) · "
    "Liquid AI x DPhi Space Hackathon #05"
)
