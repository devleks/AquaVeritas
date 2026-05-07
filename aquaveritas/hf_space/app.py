"""
AquaVeritas — HuggingFace Space
---------------------------------
Three tabs:
  1. Global Monitor  — interactive globe + per-location time series
  2. Live Prediction — static sample card (inference runs locally, not on HF)
  3. Dataset         — browse and filter the full observation history

Data is served from a bundled SQLite file (data/observations.db).
No PostgreSQL connection required.

Run locally:
    streamlit run app.py
"""

import sys
from pathlib import Path

import pandas as pd
import plotly.express as px
import pydeck as pdk
import streamlit as st

# ── Path setup ────────────────────────────────────────────────────────────────
# Allow importing locations from sibling src/ directory
ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / "src"))

from aquaveritas.locations import LOCATIONS
from db_lite import DatabaseLite

# ── Page config ───────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="AquaVeritas",
    page_icon="💧",
    layout="wide",
)

# ── Constants ─────────────────────────────────────────────────────────────────

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

# CartoDB free tile layer — no Mapbox token needed
MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

# ── Data loading ──────────────────────────────────────────────────────────────

@st.cache_data(ttl=300)
def load_all_observations():
    try:
        db = DatabaseLite()
        return db.get_observations_for_dashboard()
    except Exception as exc:
        st.error(f"Data error: {exc}")
        return []


@st.cache_data(ttl=300)
def load_latest():
    try:
        db = DatabaseLite()
        return db.get_latest_per_location()
    except Exception as exc:
        return []


def to_df(rows: list[dict]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    if "observed_at" in df.columns:
        df["observed_at"] = pd.to_datetime(df["observed_at"], format="ISO8601", utc=True)
    return df


# ── Sample prediction for Live Prediction tab ─────────────────────────────────

SAMPLE_PREDICTION = {
    "location": "Lake Chad",
    "observed_at": "2024-09-14 08:22 UTC",
    "cloud_fraction": 0.12,
    "core": {
        "water_extent_status": "shrinking",
        "flood_risk": "none",
        "water_clarity": "turbid",
        "shoreline_encroachment": True,
        "image_quality_limited": False,
    },
    "buffer": {
        "agriculture_present": True,
        "crop_stress_level": "moderate",
        "crop_stress_type": "drought",
        "cultivation_expanding_toward_water": True,
        "settlement_visible": True,
        "bare_soil_expansion": True,
    },
    "prose_brief": (
        "**Water Body Status:** The Lake Chad core zone shows continued surface area "
        "reduction consistent with multi-year hydrological stress. Shoreline "
        "encroachment is confirmed on the southwestern margin, with exposed lakebed "
        "extending approximately 2-3km beyond the 2018 baseline shoreline. Water "
        "clarity is classified as turbid, indicating elevated sediment load in the "
        "remaining open water. Flood risk is assessed as none under current conditions."
        "\n\n"
        "**Buffer Zone Assessment:** The 30km agricultural buffer shows active "
        "cultivation across approximately 60% of the visible area. Crop stress is "
        "classified as moderate drought-type, with visible chlorophyll depletion "
        "patterns in the northern field blocks. Cultivation is expanding toward the "
        "receding waterline, with newly ploughed plots visible within 1km of the "
        "current shore. Settlement density in the buffer is moderate, with visible "
        "infrastructure along the eastern approach road."
        "\n\n"
        "**Risk Verdict:** ELEVATED. Converging signals — sustained surface area "
        "reduction, active shoreline encroachment, agricultural expansion toward the "
        "waterline, and moderate crop stress — indicate Lake Chad is tracking toward "
        "a critical threshold. Immediate hydrological intervention or adaptive "
        "agricultural policy adjustment is warranted. Next satellite pass recommended "
        "within 14 days to confirm trajectory."
    ),
}


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


def _status_pill(value: str, colour_map: dict) -> str:
    colour = colour_map.get(str(value).lower(), colour_map.get("unknown", [100, 100, 100, 180]))
    r, g, b, _ = colour
    return (
        f'<span style="background:rgba({r},{g},{b},0.25);'
        f'color:rgb({r},{g},{b});border:1px solid rgba({r},{g},{b},0.5);'
        f'border-radius:4px;padding:2px 8px;font-size:0.85em;">{value}</span>'
    )


# ── Load data ─────────────────────────────────────────────────────────────────

all_rows = load_all_observations()
latest   = load_latest()
all_df   = to_df(all_rows)
latest_df = to_df(latest)
has_data = not all_df.empty

# ── Header ────────────────────────────────────────────────────────────────────

st.markdown(
    "## 💧 AquaVeritas\n"
    "On-board satellite freshwater monitoring · "
    "Fine-tuned **LFM2.5-VL-450M** · "
    "20 global sites · "
    "[Model](https://huggingface.co/Arty1001/aquaveritas-lfm-GGUF) · "
    "[Code](https://github.com/devleks/AquaVeritas)"
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

    # Sidebar-equivalent controls within the tab
    col_controls, col_map = st.columns([1, 3])

    with col_controls:
        st.markdown("**Filter**")
        selected_id = st.selectbox(
            "Water body",
            options=list(LOCATION_NAMES.keys()),
            format_func=lambda x: LOCATION_NAMES[x],
            label_visibility="collapsed",
        )
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
                f'<span style="color:rgb({r},{g},{b})">⬤</span> {status.capitalize()}',
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
            st.info("No data")

    with col_map:
        st.markdown("**Global Water Body Status**")

        if not latest_df.empty:
            map_data = latest_df.copy()
            map_data["color"] = map_data["water_extent_status"].map(
                lambda s: WATER_STATUS_COLOUR.get(
                    str(s).lower(), WATER_STATUS_COLOUR["unknown"]
                )
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
            # No observations yet — show site markers without status
            loc_df = pd.DataFrame(
                [{"name": l.name, "lat": l.lat, "lon": l.lon} for l in LOCATIONS]
            )
            layer = pdk.Layer(
                "ScatterplotLayer",
                data=loc_df,
                get_position=["lon", "lat"],
                get_fill_color=[80, 140, 200, 160],
                get_radius=150_000,
                pickable=True,
            )
            view = pdk.ViewState(latitude=15, longitude=20, zoom=1.4)
            st.pydeck_chart(
                pdk.Deck(
                    layers=[layer],
                    initial_view_state=view,
                    map_style=MAP_STYLE,
                )
            )
            st.info(
                "Observation data not yet loaded. "
                "The globe shows all 20 monitored sites."
            )

    # Per-location detail
    st.divider()
    st.markdown(f"### {LOCATION_NAMES[selected_id]}")

    loc_df = (
        all_df[all_df["location_id"] == selected_id]
        if has_data
        else pd.DataFrame()
    )

    if loc_df.empty:
        st.info(f"No observations recorded for {LOCATION_NAMES[selected_id]}.")
    else:
        col_water, col_crop = st.columns(2)

        with col_water:
            st.markdown("**Water extent status over time**")
            water_order = ["flooded", "recovering", "stable", "shrinking", "dry"]
            fig = px.scatter(
                loc_df,
                x="observed_at",
                y="water_extent_status",
                color="flood_risk",
                color_discrete_map={
                    "none": "#4CAF50",
                    "elevated": "#FF9800",
                    "active": "#F44336",
                },
                category_orders={"water_extent_status": water_order},
                labels={"observed_at": "Date", "water_extent_status": "Status"},
                height=280,
            )
            fig.update_traces(marker_size=9)
            fig.update_layout(margin=dict(l=0, r=0, t=10, b=0), showlegend=True)
            st.plotly_chart(fig, use_container_width=True)

        with col_crop:
            st.markdown("**Crop stress level over time**")
            loc_df["stress_num"] = loc_df["crop_stress_level"].map(STRESS_NUMERIC)
            fig2 = px.scatter(
                loc_df.dropna(subset=["stress_num"]),
                x="observed_at",
                y="stress_num",
                color="crop_stress_type",
                color_discrete_map={
                    "drought": "#FF6B35",
                    "flood_damage": "#4FC3F7",
                    "none": "#81C784",
                },
                labels={"observed_at": "Date", "stress_num": "Stress level"},
                height=280,
            )
            fig2.update_yaxes(
                tickvals=[0, 1, 2, 3],
                ticktext=["None", "Low", "Moderate", "Severe"],
            )
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
            enc = "expanding" if latest_row.get("cultivation_expanding") else "stable"
            st.metric("Cultivation", enc)

        with c3:
            ts = latest_row.get("observed_at")
            st.metric("Observed", str(ts)[:10] if ts else "—")
            quality_ok = not latest_row.get("image_quality_limited", False)
            st.metric("Image quality", "Good" if quality_ok else "Limited")

        # Prose brief if available
        prose = latest_row.get("prose_brief")
        if prose and str(prose).strip() and str(prose) != "None":
            st.divider()
            st.markdown("**Analyst Brief** *(generated by Claude Haiku)*")
            st.markdown(prose)


# ════════════════════════════════════════════════════════════════════════════
# TAB 2: Live Prediction
# ════════════════════════════════════════════════════════════════════════════

with tab_predict:
    st.markdown(
        "### ⚡ Live Prediction\n\n"
        "> **Note:** Live satellite inference requires running the fine-tuned "
        "LFM2.5-VL-450M model locally (430MB GGUF + 180MB vision projector). "
        "This is not feasible on HuggingFace Spaces free CPU tier. "
        "The example below is a real prediction from the local pipeline — "
        "the exact output format an analyst receives.\n\n"
        "To run live predictions on your own hardware, "
        "see the [setup guide](https://github.com/devleks/AquaVeritas#setup)."
    )

    st.divider()
    st.markdown(f"#### Sample Prediction: {SAMPLE_PREDICTION['location']}")

    meta_col, cloud_col = st.columns([3, 1])
    with meta_col:
        st.caption(f"Observed: {SAMPLE_PREDICTION['observed_at']}")
    with cloud_col:
        cloud_pct = int(SAMPLE_PREDICTION["cloud_fraction"] * 100)
        st.caption(f"Cloud cover: {cloud_pct}% (clear)")

    # Core zone
    st.markdown("**Core zone (15km x 15km — water body)**")
    core = SAMPLE_PREDICTION["core"]
    cc1, cc2, cc3, cc4, cc5 = st.columns(5)
    cc1.metric("Water status",   core["water_extent_status"])
    cc2.metric("Flood risk",     core["flood_risk"])
    cc3.metric("Clarity",        core["water_clarity"])
    cc4.metric("Shore encroach", "Yes" if core["shoreline_encroachment"] else "No")
    cc5.metric("Image quality",  "Good" if not core["image_quality_limited"] else "Limited")

    # Buffer zone
    st.markdown("**Buffer zone (30km x 30km — agricultural area)**")
    buf = SAMPLE_PREDICTION["buffer"]
    bc1, bc2, bc3, bc4, bc5, bc6 = st.columns(6)
    bc1.metric("Agriculture",   "Present" if buf["agriculture_present"] else "Absent")
    bc2.metric("Crop stress",   buf["crop_stress_level"])
    bc3.metric("Stress type",   buf["crop_stress_type"])
    bc4.metric("Cultivation",   "Expanding" if buf["cultivation_expanding_toward_water"] else "Stable")
    bc5.metric("Settlement",    "Visible" if buf["settlement_visible"] else "None")
    bc6.metric("Bare soil",     "Expanding" if buf["bare_soil_expansion"] else "Stable")

    # Prose brief
    st.divider()
    st.markdown("**Analyst Brief** *(generated by Claude Haiku from structured JSON output)*")
    st.markdown(SAMPLE_PREDICTION["prose_brief"])

    st.divider()
    st.markdown(
        "##### How it works\n\n"
        "1. **Satellite poll** — SimSat API checked every 30 seconds for proximity to monitored sites\n"
        "2. **Image acquisition** — Four Sentinel-2 tiles fetched (RGB + SWIR, core + buffer zones)\n"
        "3. **Cloud screening** — PIL-based cloud fraction estimator; tiles above 65% cloud are skipped\n"
        "4. **VLM inference** — Fine-tuned LFM2.5-VL-450M runs two inference calls per observation "
        "(core zone: 5 fields; buffer zone: 6 fields)\n"
        "5. **Prose generation** — Claude Haiku converts the structured JSON into a three-paragraph "
        "analyst-grade mission brief\n"
        "6. **Storage** — All 11 fields stored in PostgreSQL + PostGIS with geospatial footprints"
    )


# ════════════════════════════════════════════════════════════════════════════
# TAB 3: Dataset
# ════════════════════════════════════════════════════════════════════════════

with tab_data:
    st.markdown("### 📊 Observation Dataset")
    st.caption(
        "All labeled observations from the AquaVeritas monitoring pipeline. "
        "Full dataset: [devleks/aquaveritas-water-stress](https://huggingface.co/datasets/devleks/aquaveritas-water-stress)"
    )

    if not has_data:
        st.info("No observations in the bundled dataset.")
    else:
        # Filters
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

        # Status distribution chart
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
                x="water_extent_status",
                y="count",
                color="water_extent_status",
                color_discrete_map={
                    "shrinking":  "#DC3232",
                    "stable":     "#FAC832",
                    "flooded":    "#1E64C8",
                    "recovering": "#32B450",
                    "dry":        "#A0A0A0",
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
                site_counts,
                x="count",
                y="location_name",
                orientation="h",
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
