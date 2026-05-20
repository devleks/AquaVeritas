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

  const [debug, setDebug] = useState<string>("init");
  const [fatal, setFatal] = useState<string | null>(null);

  // ── Init the map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Hard precheck: WebGL must be available. Safari Private mode and some
    // privacy extensions block the WebGL context entirely, and MapLibre will
    // then fail without surfacing a useful error. Catching it ourselves lets
    // us show the user a clear explanation instead of a blank canvas.
    const testCanvas = document.createElement("canvas");
    const hasWebGL = Boolean(
      testCanvas.getContext("webgl2") ||
        testCanvas.getContext("webgl") ||
        (testCanvas.getContext("experimental-webgl") as RenderingContext | null),
    );
    if (!hasWebGL) {
      console.error("[globe] WebGL not available — map cannot render");
      setFatal(
        "WebGL is not available in this browser session. This commonly happens in Safari Private windows or with strict tracking-prevention. Switch to a normal window (or Chrome / Brave / Edge) to see the globe.",
      );
      setDebug("no webgl");
      return;
    }

    console.log("[globe] creating map instance");
    setDebug("creating map");

    // Raster OSM tiles instead of OpenFreeMap vector tiles. Trade-off:
    //   - Visually less polished than positron (raw OSM colour palette)
    //   - But: bulletproof. Just GET requests for PNGs. No style.json fetch,
    //     no vector parsing, no CDN-specific behaviour. If raster doesn't
    //     render, the failure is in the WebGL context or canvas sizing,
    //     not in the tile pipeline.
    // We can swap back to vector once /globe is verified working everywhere.
    // CARTO basemaps — public CDN, explicit CORS headers, designed for
    // use from any origin including localhost. Three layer variants
    // available; "dark_all" gives us a deep-ocean look that fits the brand
    // and contrasts the warm ochre site dots. OSM direct was failing
    // silently — likely cross-origin policy from localhost.
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          carto: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
              "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
              "https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
              "https://d.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
          },
          "carto-labels": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
              "https://b.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
              "https://c.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
              "https://d.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
          },
        },
        layers: [
          { id: "carto-base", type: "raster", source: "carto" },
          { id: "carto-labels", type: "raster", source: "carto-labels" },
        ],
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      },
      center: [14.25, 12.95], // Lake Chad
      zoom: 1.5,
      pitch: 0,
      bearing: 0,
      attributionControl: { compact: true },
    });

    // Surface tile load completion. Tile errors are caught by the
    // map.on("error", ...) handler above.
    map.on("sourcedata", (e) => {
      if (e.sourceId === "carto" && e.isSourceLoaded) {
        console.log("[globe] carto source fully loaded");
        setDebug("tiles loaded");
      }
    });
    mapRef.current = map;

    // Surface MapLibre errors during dev — silenced in prod by Next.
    map.on("error", (e) => {
      const msg = e?.error?.message ?? String(e?.error ?? e);
      console.error("[globe] maplibre error", e?.error ?? e);
      setDebug(`error: ${msg.slice(0, 80)}`);
    });

    // First "load" — fires after the first frame is rendered, not just style.
    map.on("load", () => {
      console.log("[globe] map.on(load) fired");
      setDebug("loaded");
      // Force a resize in case the container changed size during init.
      requestAnimationFrame(() => map.resize());
    });

    map.on("style.load", () => {
      console.log("[globe] style.load fired");
      setDebug("style loaded");

      // Globe projection deliberately disabled for now — investigating
      // whether v5 globe + positron is the blank-canvas culprit. Mercator
      // is reliable; the V2 plan can re-enable globe later.
      // try { map.setProjection({ type: "globe" }); } catch {}

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
      console.log("[globe] sources/layers added, styleLoaded=true");
      setDebug("ready");
    });

    // Belt-and-suspenders: observe container resize so MapLibre repaints if
    // layout shifts after init (common when fonts load and bump the page).
    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
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
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ background: "#1a2030" /* deep ink, so empty canvas is obvious */ }}
      />

      {/* Fatal error overlay (e.g. no WebGL) — visible explanation rather
          than a blank canvas. Pointer-events-auto so the user can read it. */}
      {fatal && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[color:var(--color-surface)]/95 p-12">
          <div className="max-w-md text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ochre-deep)]">
              Map unavailable in this browser
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-ink)]">
              {fatal}
            </p>
            <p className="mt-6 text-xs text-[color:var(--color-ink-muted)]">
              The site index below still works — click any &ldquo;Run
              inference →&rdquo; row to see the model&rsquo;s assessment
              of that site.
            </p>
          </div>
        </div>
      )}

      {/* Diagnostic banner — bottom of map area, bold and centred so it
          cannot be missed during debugging. Shows MapLibre lifecycle state
          + WebGL availability. Remove once /globe is verified everywhere. */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-sm border border-[color:var(--color-rule)] bg-[color:var(--color-surface)]/95 px-4 py-2 font-[family-name:var(--font-mono)] text-xs text-[color:var(--color-ink)] shadow-md backdrop-blur-sm">
        <span className="uppercase tracking-[0.16em] text-[color:var(--color-ink-faint)]">
          diag·
        </span>{" "}
        <span
          className={
            debug.startsWith("error") || debug === "no webgl"
              ? "text-[color:var(--color-ochre-deep)]"
              : "text-[color:var(--color-ink)]"
          }
        >
          {debug}
        </span>
      </div>

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
