"""Produce display-only sample tiles for the app_web demo gallery.

Why this script exists separately from `resize_images.py`
---------------------------------------------------------
`scripts/resize_images.py` is the canonical resizer for **model-input tiles**.
It enforces PNG-only, LANCZOS resampling, and a 4 MB byte cap — preserving
multispectral fidelity for downstream classification.

This script handles a different use case: the **demo gallery** on the public
`/live` page. The tiles served there are for human viewing in a ~400 px card.
They are NOT model input — actual inference uses either a live SimSat fetch
or a base64 payload from the user. Display tiles can therefore safely use
WebP, which compresses photographic content ~4–8× better than optimised PNG
at perceptually equivalent quality.

Established pattern (kept):
  - LANCZOS resampling
  - `optimize=True`
  - Iterative halving with a 256 px floor if byte budget isn't met

Justified deviation:
  - WebP, quality 88, not PNG. Display-only context, no model touches these.

Output: ~50–80 KB per tile, suitable for bundling in `app_web/public/`.

Usage:
    python scripts/copy_web_samples.py
    python scripts/copy_web_samples.py --max-bytes 102400 --max-px 512
    python scripts/copy_web_samples.py --dry-run
"""

import argparse
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image

# ── Tiles to ship in the public web bundle ───────────────────────────────────
# (site_id, date, label) — one tile per site_id at the most visually
# informative pass for that site's regime. Dates differ on purpose:
#   - shrinkage sites: dry-season capture shows the loss most starkly
#   - flooding sites: peak-flood capture shows the regime in action
#   - mixed/alpine sites: summer capture shows the lake without snow/cloud
TILES: list[tuple[str, str, str]] = [
    ("lake_chad",  "2024-01-01", "Lake Chad"),             # dry season, Sahel
    ("aral_sea",   "2024-01-01", "Aral Sea South Basin"),  # winter, salt flats clearest
    ("okavango",   "2024-07-01", "Okavango Delta"),        # peak flood pulse
    ("tonle_sap",  "2024-10-01", "Tonle Sap"),             # post-monsoon, lake at 4× normal area
    ("po_valley",  "2024-07-01", "Lake Garda"),            # alpine summer, no snow/cloud
]

# Display targets
_DEFAULT_MAX_BYTES = 100 * 1024  # 100 KB — comfortable for static site bundle
_DEFAULT_MAX_PX = 512            # gallery card is ~400 px wide on the largest viewport
_DEFAULT_WEBP_QUALITY = 88       # near-lossless for satellite imagery
_MIN_PX_FLOOR = 256              # don't degrade below this; abort instead


def encode_webp(img: Image.Image, quality: int) -> bytes:
    buf = BytesIO()
    img.save(buf, format="WEBP", quality=quality, method=6)  # method=6 → max effort
    return buf.getvalue()


def fit_to_budget(
    img: Image.Image, max_bytes: int, max_px: int, quality: int
) -> tuple[bytes, tuple[int, int]]:
    """Iteratively halve dimensions until we fit max_bytes. Floor at 256 px."""
    w, h = img.size
    if max(w, h) > max_px:
        scale = max_px / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    data = encode_webp(img, quality)
    while len(data) > max_bytes and max(img.size) > _MIN_PX_FLOOR:
        w2, h2 = img.size
        img = img.resize((w2 // 2, h2 // 2), Image.LANCZOS)
        data = encode_webp(img, quality)

    if len(data) > max_bytes:
        raise RuntimeError(
            f"Could not fit tile under {max_bytes} bytes even at {img.size}. "
            f"Raise --max-bytes or lower --quality."
        )
    return data, img.size


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Copy resized display tiles to app_web/public/sample_tiles/",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--source-dir", default="data/images",
                        help="Where the full-resolution PNG tiles live")
    parser.add_argument("--output-dir", default="app_web/public/sample_tiles",
                        help="Where to write the WebP display tiles")
    parser.add_argument("--max-bytes", type=int, default=_DEFAULT_MAX_BYTES,
                        help="Maximum bytes per tile in the web bundle")
    parser.add_argument("--max-px", type=int, default=_DEFAULT_MAX_PX,
                        help="Initial maximum dimension; halved if budget unmet")
    parser.add_argument("--quality", type=int, default=_DEFAULT_WEBP_QUALITY,
                        help="WebP quality (1-100)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Report what would be written without writing")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    src_root = (repo_root / args.source_dir).resolve()
    out_root = (repo_root / args.output_dir).resolve()

    if not args.dry_run:
        out_root.mkdir(parents=True, exist_ok=True)

    print(f"\nsrc {src_root.relative_to(repo_root)}")
    print(f"dst {out_root.relative_to(repo_root)}")
    print(f"budget {args.max_bytes // 1024} KB · max {args.max_px} px · q={args.quality} (WebP)\n")

    summary: list[tuple[str, str]] = []
    for site, date, label in TILES:
        src = src_root / site / date / "rgb_core.png"
        if not src.exists():
            print(f"  {site:24}  ✗ missing {src.relative_to(repo_root)}")
            summary.append((site, "missing"))
            continue

        img = Image.open(src).convert("RGB")
        src_size_kb = src.stat().st_size // 1024

        try:
            data, dims = fit_to_budget(
                img, args.max_bytes, args.max_px, args.quality
            )
        except RuntimeError as exc:
            print(f"  {site:24}  ✗ {exc}")
            summary.append((site, "error"))
            continue

        if args.dry_run:
            print(
                f"  {site:24}  would write {len(data)//1024} KB "
                f"@ {dims[0]}×{dims[1]} (src {src_size_kb} KB)"
            )
            summary.append((site, "dry-run"))
            continue

        dst = out_root / f"{site}.webp"
        dst.write_bytes(data)
        print(
            f"  {site:24}  ✓ {len(data)//1024} KB @ {dims[0]}×{dims[1]} "
            f"(src {src_size_kb} KB) → {dst.name}"
        )
        summary.append((site, "ok"))

    print()
    ok = sum(1 for _, s in summary if s == "ok")
    print(f"  {ok}/{len(TILES)} tiles written. Label table:")
    for site, _date, label in TILES:
        status = next(s for k, s in summary if k == site)
        print(f"    {site:24}  {label:24}  ({status})")
    return 0 if all(s != "error" for _, s in summary) else 1


if __name__ == "__main__":
    sys.exit(main())
