"use client";

import { useEffect, useState } from "react";
import {
  BUFFER_FIELDS,
  CORE_FIELDS,
  FIELD_LABELS,
  getTileUrl,
  runInference,
  type InferenceResult,
  type Prediction,
} from "@/lib/inference";
import { CATEGORY_LABEL, type Site } from "@/lib/sites";

/**
 * Inline inference card for /globe. Rendered as a floating side panel when
 * a site is selected (either by clicking a globe dot or a site-index row).
 *
 * Inference path: stub mode only — every site has a pre-computed reference
 * prediction from the fine-tuned model's eval run. Real-model inference
 * with WebGPU lives on /live where the user explicitly opts into the 200 MB
 * model download. The globe is the dataset-discovery surface; instant.
 */

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: InferenceResult }
  | { kind: "error"; message: string };

export default function GlobeInferencePanel({
  site,
  onClose,
}: {
  site: Site;
  onClose: () => void;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });

  // Re-run inference whenever the selected site changes.
  useEffect(() => {
    let cancelled = false;
    setState({ kind: "running" });
    (async () => {
      try {
        const result = await runInference(
          { siteId: site.id },
          {
            caps: { webgpu: false, wasm: false, realInference: false },
            mode: "stub",
          },
        );
        if (!cancelled) setState({ kind: "done", result });
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [site.id]);

  return (
    <aside className="absolute right-6 top-6 z-10 max-h-[calc(100%-3rem)] w-[28rem] max-w-[calc(100vw-3rem)] overflow-y-auto border border-[color:var(--color-rule)] bg-[color:var(--color-surface)]/98 shadow-md backdrop-blur-sm">
      {/* Header */}
      <div className="relative border-b border-[color:var(--color-rule)] p-6 pr-12">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="absolute right-4 top-4 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)] transition-colors hover:text-[color:var(--color-ink)]"
        >
          Close
        </button>
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ocean)]">
          {CATEGORY_LABEL[site.category]}
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl leading-tight tracking-tight text-[color:var(--color-ink)]">
          {site.name}
        </h2>
        <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[color:var(--color-ink-faint)]">
          {site.lat.toFixed(3)}°{site.lat >= 0 ? "N" : "S"} ·{" "}
          {Math.abs(site.lon).toFixed(3)}°{site.lon >= 0 ? "E" : "W"}
        </p>
      </div>

      {/* Tile preview */}
      <div className="border-b border-[color:var(--color-rule)] bg-[color:var(--color-surface-alt)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getTileUrl(site.id)}
          alt={`Sentinel-2 RGB tile of ${site.name}`}
          className="block h-48 w-full object-cover"
        />
      </div>

      {/* Context blurb */}
      {site.blurb && (
        <div className="border-b border-[color:var(--color-rule)] px-6 py-4">
          <p className="text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
            {site.blurb}
          </p>
        </div>
      )}

      {/* Inference result */}
      <div className="px-6 py-5">
        {state.kind === "running" ? (
          <Skeleton />
        ) : state.kind === "error" ? (
          <p className="text-xs leading-relaxed text-[color:var(--color-ochre-deep)]">
            {state.message}
          </p>
        ) : state.kind === "done" ? (
          <Result result={state.result} />
        ) : null}
      </div>
    </aside>
  );
}

// ── Result rendering ─────────────────────────────────────────────────────────

function Result({ result }: { result: InferenceResult }) {
  return (
    <>
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ocean)]">
          Fine-tuned reference · {result.backend}
        </p>
        <p className="font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--color-ink-faint)]">
          {result.latency_ms} ms
        </p>
      </div>

      <FieldGroup
        title="Core zone"
        fields={CORE_FIELDS}
        prediction={result.prediction}
      />
      <div className="mt-5">
        <FieldGroup
          title="Buffer zone"
          fields={BUFFER_FIELDS}
          prediction={result.prediction}
        />
      </div>
    </>
  );
}

function FieldGroup({
  title,
  fields,
  prediction,
}: {
  title: string;
  fields: Array<keyof Prediction>;
  prediction: Prediction;
}) {
  return (
    <div className="mt-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
        {title}
      </p>
      <dl className="mt-2 divide-y divide-[color:var(--color-rule)]">
        {fields.map((field) => (
          <div
            key={field}
            className="grid grid-cols-2 gap-x-3 py-2 text-xs"
          >
            <dt className="truncate text-[color:var(--color-ink-muted)]">
              {FIELD_LABELS[field]}
            </dt>
            <dd>
              <FieldValue value={prediction[field]} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FieldValue({ value }: { value: Prediction[keyof Prediction] }) {
  if (typeof value === "boolean") {
    return (
      <span
        className={`font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.14em] ${
          value
            ? "text-[color:var(--color-ochre-deep)]"
            : "text-[color:var(--color-ink-faint)]"
        }`}
      >
        {value ? "yes" : "no"}
      </span>
    );
  }
  const ACCENT = new Set([
    "shrinking", "dry", "flooded", "active", "severe", "moderate",
    "heavily_silted", "drought", "flood_damage",
  ]);
  const isAccent = ACCENT.has(value);
  return (
    <span
      className={`font-[family-name:var(--font-mono)] text-[10px] ${
        isAccent
          ? "text-[color:var(--color-ochre-deep)]"
          : "text-[color:var(--color-ink)]"
      }`}
    >
      {value.toString().replace(/_/g, " ")}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 py-2">
      <div className="h-2 w-3/4 animate-pulse bg-[color:var(--color-rule)]" />
      <div className="h-2 w-full animate-pulse bg-[color:var(--color-rule)]" />
      <div className="h-2 w-5/6 animate-pulse bg-[color:var(--color-rule)]" />
      <div className="h-2 w-2/3 animate-pulse bg-[color:var(--color-rule)]" />
    </div>
  );
}
