import React, { useState } from "react";
import type { TelemetryPoint } from "./api";

const SIM_API = "http://localhost:9005";

interface ImageryPanelProps {
  latest: TelemetryPoint | null;
}

interface ImageResult {
  url: string | null;
  metadata: Record<string, unknown>;
  error: string | null;
}

async function fetchSentinel(lon: number, lat: number, timestamp: string): Promise<ImageResult> {
  const params = new URLSearchParams({
    lon: lon.toString(),
    lat: lat.toString(),
    timestamp,
    size_km: "5.0",
    window_seconds: "2592000",
  });
  ["red", "green", "blue"].forEach((b) => params.append("spectral_bands", b));

  const res = await fetch(`${SIM_API}/data/image/sentinel?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const metadata = JSON.parse(res.headers.get("sentinel_metadata") ?? "{}");
  const blob = await res.blob();
  const url = metadata.image_available ? URL.createObjectURL(blob) : null;
  return { url, metadata, error: null };
}

async function fetchMapbox(lon: number, lat: number): Promise<ImageResult> {
  const params = new URLSearchParams({
    lon_target: lon.toString(),
    lat_target: lat.toString(),
    lon_satellite: lon.toString(),
    lat_satellite: lat.toString(),
    alt_satellite: "500",
  });

  const res = await fetch(`${SIM_API}/data/image/mapbox?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const metadata = JSON.parse(res.headers.get("mapbox_metadata") ?? "{}");
  const blob = await res.blob();
  const url = metadata.image_available ? URL.createObjectURL(blob) : null;
  return { url, metadata, error: null };
}

const ImageCard: React.FC<{ title: string; result: ImageResult | null; loading: boolean }> = ({
  title,
  result,
  loading,
}) => {
  return (
    <div className="image-card">
      <h3>{title}</h3>
      {loading ? (
        <div className="image-placeholder">Fetching...</div>
      ) : !result ? (
        <div className="image-placeholder">—</div>
      ) : result.error ? (
        <div className="image-error">{result.error}</div>
      ) : result.url ? (
        <>
          <img src={result.url} alt={title} className="satellite-image" />
          <div className="image-meta">
            {title === "Sentinel-2" ? (
              <>
                <span><span className="meta-label">Source</span>{result.metadata.source as string}</span>
                <span><span className="meta-label">Cloud</span>{((result.metadata.cloud_cover as number) ?? 0).toFixed(1)}%</span>
                <span><span className="meta-label">Captured</span>{result.metadata.datetime as string}</span>
              </>
            ) : (
              <>
                <span><span className="meta-label">Elevation</span>{((result.metadata.elevation_degrees as number) ?? 0).toFixed(1)}°</span>
                <span><span className="meta-label">Zoom</span>{((result.metadata.zoom_factor as number) ?? 0).toFixed(2)}</span>
                <span><span className="meta-label">Bearing</span>{((result.metadata.bearing as number) ?? 0).toFixed(1)}°</span>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="image-unavailable">
          {title === "Sentinel-2"
            ? "No image available — ocean or no recent acquisition"
            : "Target not visible from satellite"}
        </div>
      )}
    </div>
  );
};

export const ImageryPanel: React.FC<ImageryPanelProps> = ({ latest }) => {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [sentinelLoading, setSentinelLoading] = useState(false);
  const [mapboxLoading, setMapboxLoading] = useState(false);
  const [sentinel, setSentinel] = useState<ImageResult | null>(null);
  const [mapbox, setMapbox] = useState<ImageResult | null>(null);

  const loading = sentinelLoading || mapboxLoading;

  const useSatellitePos = () => {
    if (latest) {
      setLat(latest.latitude.toFixed(6));
      setLon(latest.longitude.toFixed(6));
    }
  };

  const handleFetch = () => {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (isNaN(latNum) || isNaN(lonNum)) return;

    setSentinel(null);
    setMapbox(null);
    setSentinelLoading(true);
    setMapboxLoading(true);

    const timestamp = latest?.timestamp ?? new Date().toISOString();

    fetchSentinel(lonNum, latNum, timestamp)
      .then((res) => setSentinel(res))
      .catch((err) => setSentinel({ url: null, metadata: {}, error: String(err) }))
      .finally(() => setSentinelLoading(false));

    fetchMapbox(lonNum, latNum)
      .then((res) => setMapbox(res))
      .catch((err) => setMapbox({ url: null, metadata: {}, error: String(err) }))
      .finally(() => setMapboxLoading(false));
  };

  const canFetch = !loading && lat.trim() !== "" && lon.trim() !== "";

  return (
    <div className="imagery-panel">
      <h2>Imagery</h2>

      <div className="imagery-form">
        <div className="imagery-inputs">
          <label>
            <span>Latitude</span>
            <input
              type="number"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="e.g. 31.005"
              step="any"
              min="-90"
              max="90"
            />
          </label>
          <label>
            <span>Longitude</span>
            <input
              type="number"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              placeholder="e.g. 47.442"
              step="any"
              min="-180"
              max="180"
            />
          </label>
        </div>
        <div className="imagery-actions">
          <button className="btn-secondary" onClick={useSatellitePos} disabled={!latest}>
            Use Satellite Position
          </button>
          <button className="btn-primary" onClick={handleFetch} disabled={!canFetch}>
            {loading ? "Fetching…" : "Fetch Images"}
          </button>
        </div>
      </div>

      <div className="imagery-results">
        <ImageCard title="Sentinel-2" result={sentinel} loading={sentinelLoading} />
        <ImageCard title="Mapbox" result={mapbox} loading={mapboxLoading} />
      </div>
    </div>
  );
};
