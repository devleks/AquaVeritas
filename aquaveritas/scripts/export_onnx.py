"""Export the fine-tuned LFM2.5-VL-450M checkpoint to ONNX for WebGPU inference.

Why this script exists
----------------------
The fine-tune we shipped for the hackathon is published as GGUF
(``Arty1001/aquaveritas-lfm-GGUF``) — llama.cpp's serving format. GGUF is not
loadable by ``onnxruntime-web`` and there is no clean GGUF → ONNX path.

To get browser-native WebGPU inference (Phase 1 of the V2 plan), we need the
**safetensors** form of the same fine-tune — the intermediate artefact that
``leap-finetune`` writes during training, *before* the GGUF conversion step.
This script takes that safetensors checkpoint and produces an ONNX file at
``data/models/aquaveritas-lfm.onnx`` that the Next.js front-end can load via
``onnxruntime-web`` with the WebGPU execution provider.

Prerequisites
-------------
1. Safetensors checkpoint of the fine-tune. Either:

   a. Local path from a leap-finetune Modal run, typically:

      ``leap-finetune/outputs/aquaveritas_finetune_modal/checkpoint-final/``

   b. Or a HuggingFace repo of the safetensors version of the fine-tune
      (publish this from leap-finetune before running GGUF conversion).

2. The matching base-model processor config so we can produce sample inputs.
   For LFM2.5-VL-450M this lives at ``LiquidAI/LFM2.5-VL-450M``.

3. Python packages (install into the project venv):

      pip install "torch>=2.4" "transformers>=4.45" "onnx>=1.16" \\
                  "onnxruntime>=1.18" "optimum[onnxruntime]>=1.21" "pillow"

   For LFM2.5-VL specifically, Optimum's ``ORTModelForVision2Seq`` already
   knows how to split vision-encoder, projector, and decoder into separate
   ONNX graphs, which is what we want for streaming load in the browser.

Usage
-----

    python scripts/export_onnx.py \\
        --checkpoint /path/to/leap-finetune/outputs/.../checkpoint-final \\
        --output     data/models/aquaveritas-lfm.onnx \\
        --quantize   fp16

    # Or from a HuggingFace repo:
    python scripts/export_onnx.py \\
        --checkpoint Arty1001/aquaveritas-lfm-safetensors \\
        --output     data/models/aquaveritas-lfm.onnx

What this script does, step by step
-----------------------------------
1. Loads the fine-tuned model in PyTorch fp16 on CPU (or CUDA if available).
2. Loads the processor (image preprocessing + tokenizer) from the same source.
3. Builds a representative sample input: one 384×384 Sentinel-2 tile and the
   AquaVeritas core-zone classification prompt.
4. Traces the model and exports via ``torch.onnx.export`` at opset 17, with
   dynamic axes for batch size and sequence length.
5. Validates the export by running both PyTorch reference and onnxruntime on
   the same sample input; logs the maximum absolute difference. Aborts if the
   difference exceeds a tolerance (default rtol=1e-2 for fp16).
6. Reports model size, ONNX opset, and the next steps for browser deployment.

Known risks
-----------
- LFM2.5-VL operators may not all be supported at the requested opset. If
  ``UnsupportedOperatorError`` fires, lower the opset to 16 or upgrade the
  PyTorch / Optimum versions.
- The multimodal projector is the operator-density hotspot. If a single graph
  export fails, run with ``--split`` to emit three separate ONNX files:
  ``encoder.onnx``, ``projector.onnx``, ``decoder.onnx``. The browser side
  then wires them in sequence — what GalamseyWatch's ``galamsey-v9-e3-onnx``
  release did.
- fp16 quantisation can produce numerical drift. Validation tolerance is set
  for fp16; if accuracy is poor in the browser, re-export at fp32 and let
  ``onnxruntime-web`` quantise at load time.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

# ── Defer heavy imports so --help and prerequisite checks remain fast ─────────


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export AquaVeritas fine-tuned LFM2.5-VL to ONNX",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--checkpoint",
        required=True,
        help="Path or HF repo of the safetensors checkpoint to export",
    )
    parser.add_argument(
        "--output",
        default="data/models/aquaveritas-lfm.onnx",
        help="Output ONNX file path (relative to repo root)",
    )
    parser.add_argument(
        "--processor",
        default="LiquidAI/LFM2.5-VL-450M",
        help="Processor (tokenizer + image processor) source",
    )
    parser.add_argument(
        "--opset",
        type=int,
        default=17,
        help="ONNX opset version (lower if unsupported operators are reported)",
    )
    parser.add_argument(
        "--quantize",
        choices=["fp32", "fp16"],
        default="fp16",
        help="Target weight precision",
    )
    parser.add_argument(
        "--split",
        action="store_true",
        help=(
            "Emit three separate ONNX graphs (encoder, projector, decoder) "
            "instead of a single combined graph. Recommended if unified export "
            "hits an UnsupportedOperatorError."
        ),
    )
    parser.add_argument(
        "--rtol",
        type=float,
        default=1e-2,
        help="Relative tolerance for the validation step",
    )
    parser.add_argument(
        "--sample-image",
        default="data/images/lake_chad/rgb_core_2024-10-15.png",
        help="Sample Sentinel-2 tile to use for tracing and validation",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run prerequisite checks and load the model, but skip export",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    out_path = (repo_root / args.output).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # ── Step 0: prerequisite check ────────────────────────────────────────────
    print("\n=== AquaVeritas ONNX export ===\n")
    print(f"  checkpoint    {args.checkpoint}")
    print(f"  processor     {args.processor}")
    print(f"  output        {out_path.relative_to(repo_root)}")
    print(f"  opset         {args.opset}")
    print(f"  precision     {args.quantize}")
    print(f"  split graphs  {args.split}")
    print()

    missing = []
    try:
        import torch  # noqa: F401
    except ImportError:
        missing.append("torch")
    try:
        import transformers  # noqa: F401
    except ImportError:
        missing.append("transformers")
    try:
        import onnx  # noqa: F401
    except ImportError:
        missing.append("onnx")
    try:
        import onnxruntime  # noqa: F401
    except ImportError:
        missing.append("onnxruntime")

    if missing:
        print("Missing required packages:", ", ".join(missing))
        print("Install with:")
        print('  pip install "torch>=2.4" "transformers>=4.45" "onnx>=1.16" \\')
        print('              "onnxruntime>=1.18" "optimum[onnxruntime]>=1.21" "pillow"')
        return 1

    import torch
    from PIL import Image
    from transformers import AutoModelForVision2Seq, AutoProcessor

    # ── Step 1: load processor + model ────────────────────────────────────────
    print("[1/5] Loading processor and model …")
    t0 = time.time()
    processor = AutoProcessor.from_pretrained(args.processor)
    dtype = torch.float16 if args.quantize == "fp16" else torch.float32
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = AutoModelForVision2Seq.from_pretrained(
        args.checkpoint,
        torch_dtype=dtype,
        device_map=device,
        trust_remote_code=True,
    )
    model.eval()
    n_params = sum(p.numel() for p in model.parameters())
    print(f"      loaded in {time.time()-t0:.1f}s · {n_params/1e6:.0f}M params on {device}")

    # ── Step 2: build sample input ────────────────────────────────────────────
    print("[2/5] Building sample input …")
    sample_path = (repo_root / args.sample_image).resolve()
    if sample_path.exists():
        image = Image.open(sample_path).convert("RGB").resize((384, 384))
        print(f"      using {sample_path.relative_to(repo_root)}")
    else:
        # Solid mid-grey fallback so the export still runs in CI
        image = Image.new("RGB", (384, 384), (128, 128, 128))
        print(f"      sample tile not found; using synthetic 384×384 grey")

    prompt = (
        "You are AquaVeritas. Analyse this Sentinel-2 RGB tile of a freshwater "
        "body. Classify across the four core-zone fields: water_extent_status, "
        "flood_risk, water_clarity, shoreline_encroachment."
    )
    inputs = processor(images=image, text=prompt, return_tensors="pt").to(device)
    print(f"      input shapes: {[(k, tuple(v.shape)) for k,v in inputs.items()]}")

    if args.dry_run:
        print("\n[dry-run] Skipping export. Prerequisites OK.\n")
        return 0

    # ── Step 3: export ────────────────────────────────────────────────────────
    print("[3/5] Tracing and exporting to ONNX …")
    t0 = time.time()

    if args.split:
        _export_split(model, inputs, processor, out_path, args.opset)
    else:
        _export_unified(model, inputs, out_path, args.opset)

    print(f"      exported in {time.time()-t0:.1f}s")

    # ── Step 4: validate ──────────────────────────────────────────────────────
    print("[4/5] Validating ONNX output against PyTorch reference …")
    _validate(model, inputs, out_path, args.rtol)

    # ── Step 5: report ────────────────────────────────────────────────────────
    print("[5/5] Done. Summary:")
    size_mb = out_path.stat().st_size / (1024 * 1024)
    manifest = {
        "checkpoint": args.checkpoint,
        "processor": args.processor,
        "opset": args.opset,
        "quantize": args.quantize,
        "split": args.split,
        "output": str(out_path.relative_to(repo_root)),
        "size_mb": round(size_mb, 1),
        "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    manifest_path = out_path.with_suffix(".manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"      {out_path.name} · {size_mb:.1f} MB · manifest: {manifest_path.name}")

    print("\nNext steps:")
    print("  1. Publish to HuggingFace:")
    print("       huggingface-cli upload Arty1001/aquaveritas-lfm-onnx \\")
    print(f"           {out_path.relative_to(repo_root)} .")
    print("  2. Wire into the browser:")
    print("       app_web/src/lib/inference.ts (Phase 1 deliverable)")
    print("  3. Smoke-test in Chrome with chrome://gpu open and WebGPU enabled.")
    return 0


# ── Export strategies ─────────────────────────────────────────────────────────


def _export_unified(model, inputs, out_path: Path, opset: int) -> None:
    """Single combined ONNX graph. Simpler but risks unsupported-operator errors."""
    import torch

    input_names = list(inputs.keys())
    dynamic_axes = {name: {0: "batch"} for name in input_names}
    if "input_ids" in dynamic_axes:
        dynamic_axes["input_ids"][1] = "seq"
        dynamic_axes["attention_mask"][1] = "seq"
    dynamic_axes["logits"] = {0: "batch", 1: "seq"}

    with torch.no_grad():
        torch.onnx.export(
            model,
            tuple(inputs.values()),
            str(out_path),
            export_params=True,
            opset_version=opset,
            do_constant_folding=True,
            input_names=input_names,
            output_names=["logits"],
            dynamic_axes=dynamic_axes,
        )


def _export_split(model, inputs, processor, out_path: Path, opset: int) -> None:
    """Three separate ONNX graphs — encoder, projector, decoder.

    Required when LFM2.5-VL's combined graph hits operator support gaps. Mirrors
    GalamseyWatch's `samwell/galamsey-v9-e3-onnx` release structure.
    """
    raise NotImplementedError(
        "Split export is a Phase-1.5 feature. Run unified first; if it fails "
        "with an UnsupportedOperatorError, implement the split path here. "
        "Reference: https://huggingface.co/samwell/galamsey-v9-e3-onnx/tree/main"
    )


# ── Validation ────────────────────────────────────────────────────────────────


def _validate(model, inputs, out_path: Path, rtol: float) -> None:
    """Run PyTorch and onnxruntime on the same sample; compare max abs diff."""
    import numpy as np
    import onnxruntime as ort
    import torch

    with torch.no_grad():
        ref_out = model(**inputs).logits.cpu().float().numpy()

    session = ort.InferenceSession(
        str(out_path), providers=["CPUExecutionProvider"]
    )
    ort_inputs = {k: v.cpu().numpy() for k, v in inputs.items()}
    ort_out = session.run(None, ort_inputs)[0]

    max_abs = float(np.max(np.abs(ref_out - ort_out)))
    rel = max_abs / (float(np.max(np.abs(ref_out))) + 1e-8)
    print(f"      max abs diff  {max_abs:.4e}")
    print(f"      relative diff {rel:.4e}  (rtol={rtol})")
    if rel > rtol:
        raise RuntimeError(
            f"ONNX output drifted beyond tolerance ({rel:.4e} > {rtol:.4e}). "
            "Try --quantize fp32 or lower --opset."
        )
    print(f"      ✓ within tolerance")


if __name__ == "__main__":
    sys.exit(main())
