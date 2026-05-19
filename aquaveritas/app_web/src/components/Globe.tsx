"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, {
  GeoJSONSource,
  Map as MLMap,
  MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  SITES,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  type SiteCategory,
} from "@/lib/sites";

/**
 * Globe — MapLibre GL with native globe projection (v5+).
 *
 * Controlled component: parent owns `selectedId`. We emit changes through
 * `onSelectChange`. The visible detail / inference panel is rendered by the
 * parent (/globe page) using GlobeInferencePanel.
 *
 * Tile source: OpenFreeMap "positron" — no API key, vector tiles, free CDN.
 * Markers: GeoJSON source with halo + dot circle layers, filtered by the
 * currently-enabled categories.
 * Legend doubles as the category filter — click a category chip to toggle.
 *
 * Loading: no opaque overlay. The map renders progressively as MapLibre
 * paints tiles; an earlier shim version occluded the map when style.load
 * was slow or failed silently.
 */

export interface GlobeProps {
  selectedId: string | null;
  onSelectChange: (id: string | null) => void;
}

export default function Globe({ selectedId, onSelectChange }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);

  const allCategories = useMemo(
    () => Object.keys(CATEGORY_LABEL) as SiteCategory[],
    [],
  );
  const [active, setActive] = useState<Set<SiteCategory>>(
    () => new Set(allCategories),
  );

  // Refresh the source on filter or selection change. Kept in a ref so the
  // map event handlers always see the latest data without re-binding.
  const onSelectRef = useRef(onSelectChange);
  useEffect(() => {
    onSelectRef.current = onSelectChange;
  }, [onSelectChange]);

  // ── Init the map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [14.25, 12.95], // Lake Chad
      zoom: 1.3,
      pitch: 0,
      bearing: 0,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    // Surface MapLibre errors during dev — silenced in prod by Next.
    map.on("error", (e) => {
      console.error("[globe] maplibre error", e?.error ?? e);
    });

    map.on("style.load", () => {
      try {
        map.setProjection({ type: "globe" });
      } catch {
        /* mercator fallback on older clients */
      }

      try {
        map.addSource("sites", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "sites-halo",
          type: "circle",
          source: "sites",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 8, 5, 18],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.18,
            "circle-stroke-width": 0,
          },
        });
        map.addLayer({
          id: "sites-dot",
          type: "circle",
          source: "sites",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 4, 5, 7],
            "circle-color": ["get", "color"],
            "circle-stroke-color": "#FFFFFF",
            "circle-stroke-width": 1.5,
            "circle-stroke-opacity": 0.95,
          },
        });

        map.on("mouseenter", "sites-dot", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "sites-dot", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", "sites-dot", (e: MapLayerMouseEvent) => {
          const f = e.features?.[0];
          if (!f) return;
          const id = (f.properties as { id: string }).id;
          onSelectRef.current(id);
        });
      } catch (err) {
        console.error("[globe] failed adding sources/layers:", err);
      }

      setStyleLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setStyleLoaded(false);
    };
  }, []);

  // ── Push filtered features into the source ───────────────────────────────
  useEffect(() => {
    if (!styleLoaded || !mapRef.current) return;
    const features = SITES.filter((s) => active.has(s.category)).map((s) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
      properties: {
        id: s.id,
        name: s.name,
        category: s.category,
        color: CATEGORY_COLOR[s.category],
      },
    }));
    const source = mapRef.current.getSource("sites") as GeoJSONSource | undefined;
    source?.setData({ type: "FeatureCollection", features });

    // If the currently-selected site got filtered out, clear it upstream.
    if (selectedId) {
      const stillVisible = features.some((f) => f.properties.id === selectedId);
      if (!stillVisible) onSelectRef.current(null);
    }
  }, [active, styleLoaded, selectedId]);

  // ── External selection (e.g. clicked from site index) → fly to it ────────
  useEffect(() => {
    if (!styleLoaded || !mapRef.current || !selectedId) return;
    const site = SITES.find((s) => s.id === selectedId);
    if (!site) return;
    mapRef.current.flyTo({
      center: [site.lon, site.lat],
      zoom: Math.max(mapRef.current.getZoom(), 3.2),
      speed: 0.7,
      curve: 1.4,
      essential: true,
    });
  }, [selectedId, styleLoaded]);

  const toggleCategory = useCallback(
    (cat: SiteCategory) => {
      setActive((prev) => {
        const next = new Set(prev);
        if (next.has(cat)) {
          if (next.size === 1) return new Set(allCategories);
          next.delete(cat);
        } else {
          next.add(cat);
        }
        return next;
      });
    },
    [allCategories],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<SiteCategory, number> = {
      shrinkage: 0,
      flooding: 0,
      mixed: 0,
    };
    for (const s of SITES) counts[s.category] += 1;
    return counts;
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Legend / filter — pointer-events-none on wrapper so map underneath
          stays clickable; the buttons re-enable pointer events. */}
      <div className="pointer-events-none absolute left-6 top-6 z-10 flex flex-col gap-2 rounded-sm border border-[color:var(--color-rule)] bg-[color:var(--color-surface)]/95 p-4 text-xs shadow-sm backdrop-blur-sm">
        <p className="font-medium uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
          Click to filter
        </p>
        {allCategories.map((k) => {
          const isOn = active.has(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggleCategory(k)}
              className={`pointer-events-auto flex items-center gap-2 text-left transition-opacity duration-300 ${
                isOn ? "opacity-100" : "opacity-30 hover:opacity-60"
              }`}
              style={{ transitionTimingFunction: "var(--ease-out-quint)" }}
              aria-pressed={isOn}
            >
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: CATEGORY_COLOR[k] }}
              />
              <span className="text-[color:var(--color-ink-muted)]">
                {CATEGORY_LABEL[k]}
              </span>
              <span className="ml-auto pl-3 font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--color-ink-faint)]">
                {categoryCounts[k]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
