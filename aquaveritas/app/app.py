"""
AquaVeritas Streamlit Dashboard
---------------------------------
Displays inference results from the Postgres database:
  - World map: 12 water bodies colour-coded by latest status
  - Per-location: water extent + crop stress time series
  - Latest observation card with thumbnail images
  - Summary: locations with sustained shrinkage signal

Run:
    streamlit run app/app.py
"""

import sys
from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import pydeck as pdk
import streamlit as st

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from aquaveritas.db import Database
from aquaveritas.locations import LOCATIONS

# ── Config ────────────────────────────────────────────────────────────────────

st.set_page_config(
    page_title = "AquaVeritas",
    page_icon  = "💧",
    layout     = "wide",
)

WATER_STATUS_COLOUR = {
    "shrinking":  [220, 50,  50,  200],   # red
    "stable":     [250, 200, 50,  200],   # yellow
    "flooded":    [30,  100, 200, 200],   # blue
    "recovering": [50,  180, 80,  200],   # green
    "dry":        [160, 160, 160, 200],   # grey
    "unknown":    [100, 100, 100, 180],
}

STRESS_NUMERIC = {"none": 0, "low": 1, "moderate": 2, "severe": 3}

# ── Data loading ──────────────────────────────────────────────────────────────

@st.cache_data(ttl=60)
def load_all_observations():
    try:
        db = Database()
        return db.get_observations_for_dashboard()
    except Exception as exc:
        st.error(f"Database error: {exc}")
        return []


@st.cache_data(ttl=60)
def load_latest():
    try:
        db = Database()
        return db.get_latest_per_location()
    except Exception as exc:
        return []


def to_df(rows: list[dict]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    if "observed_at" in df.columns:
        df["observed_at"] = pd.to_datetime(df["observed_at"], utc=True)
    return df


# ── Layout ────────────────────────────────────────────────────────────────────

st.title("💧 AquaVeritas")
st.caption("On-board satellite freshwater monitoring — Liquid AI × DPhi Space Hackathon")

all_rows  = load_all_observations()
latest    = load_latest()
all_df    = to_df(all_rows)
latest_df = to_df(latest)

has_data = not all_df.empty

# ── Sidebar ───────────────────────────────────────────────────────────────────

with st.sidebar:
    st.header("Controls")
    location_names = {loc.id: loc.name for loc in LOCATIONS}
    selected_id    = st.selectbox(
        "Select water body",
        options    = list(location_names.keys()),
        format_func= lambda x: location_names[x],
    )
    st.divider()
    st.metric("Total observations", len(all_df) if has_data else 0)
    st.metric("Locations monitored", len(LOCATIONS))
    if st.button("Refresh data"):
        st.cache_data.clear()
        st.rerun()

# ── Top row: map + summary ────────────────────────────────────────────────────

col_map, col_summary = st.columns([2, 1])

with col_map:
    st.subheader("Global Water Body Status")

    if not latest_df.empty:
        map_data = latest_df.copy()
        map_data["color"] = map_data["water_extent_status"].map(
            lambda s: WATER_STATUS_COLOUR.get(str(s).lower(),
                                              WATER_STATUS_COLOUR["unknown"])
        )
        map_data["tooltip"] = (
            map_data["location_name"] + "\n"
            + "Water: " + map_data["water_extent_status"].fillna("?") + "\n"
            + "Crop stress: " + map_data["crop_stress_level"].fillna("?")
        )

        layer = pdk.Layer(
            "ScatterplotLayer",
            data             = map_data,
            get_position     = ["lon", "lat"],
            get_fill_color   = "color",
            get_radius       = 120_000,
            pickable         = True,
            stroked          = True,
            get_line_color   = [255, 255, 255, 120],
            get_line_width   = 2,
        )
        view = pdk.ViewState(latitude=15, longitude=30, zoom=1.5, pitch=0)
        st.pydeck_chart(pdk.Deck(
            layers     = [layer],
            initial_view_state = view,
            tooltip    = {"text": "{tooltip}"},
            map_style  = "mapbox://styles/mapbox/dark-v10",
        ))
    else:
        st.info("No observations yet. Run `scripts/predict.py` or `scripts/label_data.py` to generate data.")
        # Show location markers without status
        loc_df = pd.DataFrame([{"name": l.name, "lat": l.lat, "lon": l.lon} for l in LOCATIONS])
        layer  = pdk.Layer("ScatterplotLayer", data=loc_df,
                           get_position=["lon", "lat"],
                           get_fill_color=[100, 150, 200, 160],
                           get_radius=120_000, pickable=True)
        view   = pdk.ViewState(latitude=15, longitude=30, zoom=1.5)
        st.pydeck_chart(pdk.Deck(layers=[layer], initial_view_state=view,
                                 map_style="mapbox://styles/mapbox/dark-v10"))

with col_summary:
    st.subheader("Status Legend")
    for status, colour in WATER_STATUS_COLOUR.items():
        if status == "unknown":
            continue
        r, g, b, _ = colour
        st.markdown(
            f'<span style="color:rgb({r},{g},{b})">⬤</span> {status.capitalize()}',
            unsafe_allow_html=True,
        )

    st.divider()
    st.subheader("Sustained Shrinkage")
    st.caption("Locations with 3+ consecutive 'shrinking' observations")

    if has_data:
        shrink_locs = _sustained_shrinkage(all_df)
        if shrink_locs:
            for loc_id, count in shrink_locs:
                name = location_names.get(loc_id, loc_id)
                st.warning(f"⚠ **{name}** — {count} consecutive")
        else:
            st.success("No sustained shrinkage detected")
    else:
        st.info("No data yet")

# ── Per-location detail ───────────────────────────────────────────────────────

st.divider()
st.subheader(f"📍 {location_names[selected_id]}")

loc_df = all_df[all_df["location_id"] == selected_id] if has_data else pd.DataFrame()

if loc_df.empty:
    st.info(f"No observations yet for {location_names[selected_id]}.")
else:
    col_water, col_crop = st.columns(2)

    with col_water:
        st.markdown("**Water Body Status Over Time**")
        water_order = ["flooded", "recovering", "stable", "shrinking", "dry"]
        fig = px.scatter(
            loc_df, x="observed_at", y="water_extent_status",
            color="flood_risk",
            color_discrete_map={"none": "#4CAF50", "elevated": "#FF9800", "active": "#F44336"},
            category_orders={"water_extent_status": water_order},
            labels={"observed_at": "Date", "water_extent_status": "Status"},
            height=300,
        )
        fig.update_traces(marker_size=8)
        fig.update_layout(margin=dict(l=0, r=0, t=10, b=0), showlegend=True)
        st.plotly_chart(fig, use_container_width=True)

    with col_crop:
        st.markdown("**Crop Stress Level Over Time**")
        loc_df["stress_num"] = loc_df["crop_stress_level"].map(STRESS_NUMERIC)
        fig2 = px.scatter(
            loc_df.dropna(subset=["stress_num"]),
            x="observed_at", y="stress_num",
            color="crop_stress_type",
            color_discrete_map={"drought": "#FF6B35", "flood_damage": "#4FC3F7", "none": "#81C784"},
            labels={"observed_at": "Date", "stress_num": "Stress Level"},
            height=300,
        )
        fig2.update_yaxes(tickvals=[0,1,2,3], ticktext=["None","Low","Moderate","Severe"])
        fig2.update_traces(marker_size=8)
        fig2.update_layout(margin=dict(l=0, r=0, t=10, b=0))
        st.plotly_chart(fig2, use_container_width=True)

    # ── Latest observation card ───────────────────────────────────────────────
    st.markdown("**Latest Observation**")
    latest_row = loc_df.sort_values("observed_at").iloc[-1]
    c1, c2, c3 = st.columns(3)

    with c1:
        st.metric("Water Status",  str(latest_row.get("water_extent_status", "—")))
        st.metric("Flood Risk",    str(latest_row.get("flood_risk", "—")))
        st.metric("Water Clarity", str(latest_row.get("water_clarity", "—")))

    with c2:
        st.metric("Crop Stress", str(latest_row.get("crop_stress_level", "—")))
        st.metric("Stress Type", str(latest_row.get("crop_stress_type",  "—")))
        enc = "expanding" if latest_row.get("cultivation_expanding") else "stable"
        st.metric("Cultivation", enc)

    with c3:
        ts = latest_row.get("observed_at")
        st.metric("Observed",  str(ts)[:10] if ts else "—")
        img_path = latest_row.get("rgb_core_path")
        if img_path and Path(img_path).exists():
            st.image(img_path, caption="RGB Core (5km)", use_column_width=True)

# ── Footer ────────────────────────────────────────────────────────────────────

st.divider()
st.caption(
    "AquaVeritas — on-board LFM2.5-VL-450M inference via SimSat + Sentinel-2 | "
    "Hack #05: AI in Space"
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sustained_shrinkage(df: pd.DataFrame, threshold: int = 3) -> list[tuple]:
    results = []
    for loc_id in df["location_id"].unique():
        sub = (df[df["location_id"] == loc_id]
               .sort_values("observed_at")["water_extent_status"]
               .tolist())
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
