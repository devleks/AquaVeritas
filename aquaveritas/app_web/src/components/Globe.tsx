"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, {
  Map as MLMap,
  MapLayerMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SITES, CATEGORY_COLOR, CATEGORY_LABEL, type Site } from "@/lib/sites";

/**
 * Globe — MapLibre GL with native globe projection (v5+).
 *
 * Tile source: OpenFreeMap "positron" — no API key, vector tiles, free CDN.
 * Markers: GeoJSON source with a circle layer, coloured by site category.
 * Click a site → side panel shows blurb + Sentinel-2 quick link.
 *
 * Initial view: centred on Lake Chad to anchor the singular-crisis frame.
 */
export default function Globe() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [selected, setSelected] = useState<Site | null>(null);

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

    // Native globe projection (MapLibre 5+)
    map.on("style.load", () => {
      try {
        map.setProjection({ type: "globe" });
      } catch {
        // Fallback to mercator on older clients — no-op.
      }

      // GeoJSON source of sites
      const features = SITES.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
        properties: {
          id: s.id,
          name: s.name,
          category: s.category,
          color: CATEGORY_COLOR[s.category],
        },
      }));

      map.addSource("sites", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });

      // Halo (soft outer ring) for visibility against light/dark land
      map.addLayer({
        id: "sites-halo",
        type: "circle",
        source: "sites",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1,
            8,
            5,
            18,
          ],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.18,
          "circle-stroke-width": 0,
        },
      });

      // Solid marker on top
      map.addLayer({
        id: "sites-dot",
        type: "circle",
        source: "sites",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            1,
            4,
            5,
            7,
          ],
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 1.5,
          "circle-stroke-opacity": 0.95,
        },
      });

      // Cursor + click interactions
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
        const site = SITES.find((s) => s.id === id) ?? null;
        setSelected(site);
        if (site) {
          map.flyTo({
            center: [site.lon, site.lat],
            zoom: Math.max(map.getZoom(), 3.2),
            speed: 0.7,
            curve: 1.4,
            essential: true,
          });
        }
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Legend */}
      <div className="pointer-events-none absolute left-6 top-6 z-10 flex flex-col gap-2 rounded-sm border border-[color:var(--color-rule)] bg-[color:var(--color-surface)]/95 p-4 text-xs shadow-sm backdrop-blur-sm">
        <p className="font-medium uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
          Site category
        </p>
        {(Object.keys(CATEGORY_LABEL) as Array<keyof typeof CATEGORY_LABEL>).map(
          (k) => (
            <div key={k} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: CATEGORY_COLOR[k] }}
              />
              <span className="text-[color:var(--color-ink-muted)]">
                {CATEGORY_LABEL[k]}
              </span>
            </div>
          ),
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <aside className="absolute right-6 top-6 z-10 w-80 border border-[color:var(--color-rule)] bg-[color:var(--color-surface)]/98 p-6 shadow-md backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="absolute right-4 top-4 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)] transition-colors hover:text-[color:var(--color-ink)]"
          >
            Close
          </button>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ocean)]">
            {CATEGORY_LABEL[selected.category]}
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl leading-tight tracking-tight text-[color:var(--color-ink)]">
            {selected.name}
          </h2>
          <p className="mt-3 text-xs font-[family-name:var(--font-mono)] text-[color:var(--color-ink-faint)]">
            {selected.lat.toFixed(3)}°{selected.lat >= 0 ? "N" : "S"} · {" "}
            {Math.abs(selected.lon).toFixed(3)}°{selected.lon >= 0 ? "E" : "W"}
          </p>
          {selected.blurb && (
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
              {selected.blurb}
            </p>
          )}
          <a
            href={`/live?site=${selected.id}`}
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[color:var(--color-ink)] underline decoration-[color:var(--color-rule)] decoration-2 underline-offset-4 transition-colors hover:decoration-[color:var(--color-ocean)]"
          >
            Run inference on this site
            <span aria-hidden>→</span>
          </a>
        </aside>
      )}
    </div>
  );
}
