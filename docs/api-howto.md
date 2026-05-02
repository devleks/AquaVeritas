# SimSat API — How-To Guide

Base URL: `http://localhost:9005`

Ensure the stack is running (`docker compose up`) and the simulation has been started from the dashboard at `http://localhost:8000` before making requests.

---

## Quick Example — Side-by-Side Display

Fetches Sentinel-2 and Mapbox images for a given location and displays them in a single matplotlib window. Tested and confirmed working.

```python
import requests
import json
import io
import matplotlib.pyplot as plt
import matplotlib.image as mpimg

BASE_URL = "http://localhost:9005"
LON, LAT = 47.442, 31.005  # Euphrates River, Iraq

# Sentinel
r_s = requests.get(f"{BASE_URL}/data/image/sentinel", params={
    "lon": LON, "lat": LAT,
    "timestamp": "2026-04-01T00:00:00Z",
    "spectral_bands": ["red", "green", "blue"],
    "size_km": 5.0,
    "window_seconds": 2592000,  # 30-day search window
})
meta_s = json.loads(r_s.headers["sentinel_metadata"])

# Mapbox
r_m = requests.get(f"{BASE_URL}/data/image/mapbox", params={
    "lon_target": LON, "lat_target": LAT,
    "lon_satellite": LON, "lat_satellite": LAT,
    "alt_satellite": 500,
})
meta_m = json.loads(r_m.headers["mapbox_metadata"])

fig, axes = plt.subplots(1, 2, figsize=(14, 7))
fig.suptitle("Euphrates River — 31°0′18″N 47°26′31″E", fontsize=14)

if meta_s["image_available"]:
    axes[0].imshow(mpimg.imread(io.BytesIO(r_s.content), format="PNG"))
    axes[0].set_title(f"Sentinel-2 ({meta_s['source']})\n{meta_s['datetime']}  |  cloud: {meta_s['cloud_cover']:.1f}%")
else:
    axes[0].text(0.5, 0.5, "No image available", ha="center", va="center")
    axes[0].set_title("Sentinel-2 — No data")
axes[0].axis("off")

if meta_m["image_available"]:
    axes[1].imshow(mpimg.imread(io.BytesIO(r_m.content), format="PNG"))
    axes[1].set_title(f"Mapbox  |  elev: {meta_m['elevation_degrees']:.1f}°  |  zoom: {meta_m['zoom_factor']:.2f}")
else:
    axes[1].text(0.5, 0.5, "No image available", ha="center", va="center")
    axes[1].set_title("Mapbox — No data")
axes[1].axis("off")

plt.tight_layout()
plt.show()
```

> Use a 30-day `window_seconds` (2592000) for Sentinel to improve the chance of finding a cloud-free acquisition.

---

## 1. Get Current Satellite Position

### curl
```bash
curl http://localhost:9005/data/current/position
```

### Python
```python
import requests

response = requests.get("http://localhost:9005/data/current/position")
data = response.json()

lon, lat, alt_km = data["lon-lat-alt"]
timestamp = data["timestamp"]

print(f"Position: lon={lon:.4f}, lat={lat:.4f}, alt={alt_km:.1f} km")
print(f"Timestamp: {timestamp}")
```

### Response
```json
{
  "lon-lat-alt": [130.39, 17.87, 791.3],
  "timestamp": "2026-01-01T16:00:00Z"
}
```

---

## 2. Sentinel-2 Image — Current Position

Returns a PNG image and metadata for the satellite's current position.

### curl
```bash
# Save image to file, print metadata from response header
curl -s \
  "http://localhost:9005/data/current/image/sentinel?spectral_bands=red&spectral_bands=green&spectral_bands=blue&size_km=5.0&return_type=png" \
  -D - \
  -o sentinel.png \
  | grep sentinel_metadata
```

### Python
```python
import requests
import json
from PIL import Image
import io

params = {
    "spectral_bands": ["red", "green", "blue"],
    "size_km": 5.0,
    "return_type": "png",
    "window_seconds": 864000,  # search up to 10 days back
}

response = requests.get(
    "http://localhost:9005/data/current/image/sentinel",
    params=params
)

metadata = json.loads(response.headers["sentinel_metadata"])
print(f"Image available: {metadata['image_available']}")
print(f"Cloud cover: {metadata['cloud_cover']:.1f}%")
print(f"Captured: {metadata['datetime']}")
print(f"Source: {metadata['source']}")

if metadata["image_available"]:
    image = Image.open(io.BytesIO(response.content))
    image.save("sentinel_current.png")
```

### Notes
- `image_available` is `False` over oceans or near the poles where Sentinel-2 does not acquire
- Increase `window_seconds` if no image is found (default 10 days)
- Available `spectral_bands`: `red`, `green`, `blue`, `nir`, `nir08`, `nir09`, `rededge1`, `rededge2`, `rededge3`, `swir16`, `swir22`, `coastal`, `scl`, `aot`, `wvp`, `visual`

---

## 3. Sentinel-2 Image — Arbitrary Location & Time

Query any location and timestamp, independent of the running simulation.

### curl
```bash
curl -s \
  "http://localhost:9005/data/image/sentinel?lon=6.6323&lat=46.5197&timestamp=2026-03-01T16:00:00Z&spectral_bands=red&spectral_bands=green&spectral_bands=blue&size_km=5.0" \
  -o sentinel_lausanne.png
```

### Python
```python
import requests
import json
from PIL import Image
import io

params = {
    "lon": 6.6323,
    "lat": 46.5197,
    "timestamp": "2026-03-01T16:00:00Z",
    "spectral_bands": ["red", "green", "blue"],
    "size_km": 5.0,
    "return_type": "png",
}

response = requests.get(
    "http://localhost:9005/data/image/sentinel",
    params=params
)

metadata = json.loads(response.headers["sentinel_metadata"])
print(metadata)

if metadata["image_available"]:
    image = Image.open(io.BytesIO(response.content))
    image.save("sentinel_lausanne.png")
```

---

## 4. Mapbox Image — Current Position

Returns a high-resolution PNG from Mapbox based on the satellite's current viewing geometry. Requires `MAPBOX_ACCESS_TOKEN` to be set.

### curl
```bash
# Nadir view (satellite looking straight down)
curl -s \
  "http://localhost:9005/data/current/image/mapbox" \
  -o mapbox_current.png

# Off-nadir — point camera at a specific target
curl -s \
  "http://localhost:9005/data/current/image/mapbox?lon=6.6323&lat=46.5197" \
  -o mapbox_target.png
```

### Python
```python
import requests
import json
from PIL import Image
import io

# Nadir view
response = requests.get("http://localhost:9005/data/current/image/mapbox")

metadata = json.loads(response.headers["mapbox_metadata"])
print(f"Target visible: {metadata['target_visible']}")
print(f"Elevation angle: {metadata['elevation_degrees']:.1f}°")

if metadata["image_available"]:
    image = Image.open(io.BytesIO(response.content))
    image.save("mapbox_current.png")
```

### Notes
- `target_visible` is `False` when elevation angle < 30° — no image is returned
- The bearing and pitch are calculated automatically from the satellite-to-target geometry

---

## 5. Mapbox Image — Arbitrary Geometry

Specify satellite position and target explicitly.

### curl
```bash
curl -s \
  "http://localhost:9005/data/image/mapbox?lon_target=6.6323&lat_target=46.5197&lon_satellite=6.6323&lat_satellite=46.5197&alt_satellite=500" \
  -o mapbox_lausanne.png
```

### Python
```python
import requests
import json
from PIL import Image
import io

params = {
    "lon_target": 6.6323,
    "lat_target": 46.5197,
    "lon_satellite": 6.6323,
    "lat_satellite": 46.5197,
    "alt_satellite": 500,  # km
}

response = requests.get(
    "http://localhost:9005/data/image/mapbox",
    params=params
)

metadata = json.loads(response.headers["mapbox_metadata"])
print(metadata)

if metadata["image_available"]:
    image = Image.open(io.BytesIO(response.content))
    image.save("mapbox_lausanne.png")
```

---

## 6. Multispectral Comparison

Fetch the same location in multiple band combinations and display side-by-side.

### Python
```python
import requests
import json
import io
import matplotlib.pyplot as plt
import matplotlib.image as mpimg

BASE_URL = "http://localhost:9005"

# Get current position first so all band requests use the same location
pos = requests.get(f"{BASE_URL}/data/current/position").json()
lon, lat, _ = pos["lon-lat-alt"]
timestamp = pos["timestamp"]

band_sets = [
    ["red", "green", "blue"],       # True colour
    ["nir", "red", "green"],         # False colour infrared
    ["swir22", "nir", "green"],      # SWIR composite
    ["rededge1", "rededge2", "rededge3"],  # Red-edge
]

images = []
for bands in band_sets:
    params = {
        "lon": lon, "lat": lat, "timestamp": timestamp,
        "spectral_bands": bands, "size_km": 5.0, "return_type": "png",
    }
    r = requests.get(f"{BASE_URL}/data/image/sentinel", params=params)
    metadata = json.loads(r.headers.get("sentinel_metadata", "{}"))
    if metadata.get("image_available"):
        images.append((mpimg.imread(io.BytesIO(r.content), format="PNG"), bands))

fig, axes = plt.subplots(1, len(images), figsize=(5 * len(images), 5))
for ax, (img, bands) in zip(axes, images):
    ax.imshow(img)
    ax.set_title("/".join(bands))
    ax.axis("off")
plt.tight_layout()
plt.show()
```

---

## Response Metadata Reference

### Sentinel metadata (in `sentinel_metadata` response header)
| Field | Type | Description |
|---|---|---|
| `image_available` | bool | Whether an image was found |
| `source` | str | `sentinel-2a`, `sentinel-2b`, or `sentinel-2c` |
| `spectral_bands` | list | Bands returned |
| `footprint` | list | `[lon_min, lat_min, lon_max, lat_max]` |
| `size_km` | float | Image side length in km |
| `cloud_cover` | float | Cloud cover percentage |
| `datetime` | str | When the image was captured (UTC ISO-8601) |
| `timestamp` | str | Simulation time of the request (current endpoints only) |
| `satellite_position` | list | `[lon, lat, alt_km]` (current endpoints only) |

### Mapbox metadata (in `mapbox_metadata` response header)
| Field | Type | Description |
|---|---|---|
| `target_visible` | bool | Whether target is above 30° elevation |
| `image_available` | bool | Whether an image was returned |
| `elevation_degrees` | float | Satellite elevation angle above target |
| `zoom_factor` | float | Mapbox zoom level used |
| `bearing` | float | Camera heading in degrees |
| `pitch` | float | Camera tilt in degrees |
| `timestamp` | str | Simulation time of the request (current endpoints only) |
| `satellite_position` | list | `[lon, lat, alt_km]` (current endpoints only) |
