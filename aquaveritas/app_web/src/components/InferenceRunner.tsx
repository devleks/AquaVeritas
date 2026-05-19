"use client";

import { useEffect, useState } from "react";
import {
  BUFFER_FIELDS,
  CORE_FIELDS,
  FIELD_LABELS,
  SAMPLE_TILES,
  type InferenceResult,
  type Prediction,
  type RuntimeCapabilities,
  type SampleTile,
  detectCapabilities,
  runInference,
} from "@/lib/inference";

type RunState =
  | { kind: "idle" }
  | { kind: "running"; siteId: string }
  | { kind: "done"; siteId: string; result: InferenceResult }
  | { kind: "error"; message: string };

/**
 * /live page main controller.
 *
 * Layout: 12-col grid. Left column lists tile thumbnails; right column shows
 * either a "pick a tile" prompt or the inference result. Result panel uses
 * the dual-zone (core / buffer) language from the methodology, mirroring the
 * model's output structure.
 */
export default function InferenceRunner() {
  const [caps, setCaps] = useState<RuntimeCapabilities | null>(null);
  const [state, setState] = useState<RunState>({ kind: "idle" });

  useEffect(() => {
    detectCapabilities().then(setCaps);
  }, []);

  async function handleRun(tile: SampleTile) {
    if (!caps) return;
    setState({ kind: "running", siteId: tile.siteId });
    try {
      const result = await runInference({ siteId: tile.siteId }, caps);
      setState({ kind: "done", siteId: tile.siteId, result });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <CapabilityBanner caps={caps} />

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-12">
        {/* ── Gallery (4 cols on lg) ──────────────────────────────────────── */}
        <section className="lg:col-span-4">
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
            Sample tiles
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl leading-tight tracking-tight text-[color:var(--color-ink)]">
            Pick a freshwater body
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
            Each tile is a Sentinel-2 RGB capture at 10 m resolution, taken
            during the 2024-01-01 pass.
          </p>
          <ul className="mt-8 space-y-3">
            {SAMPLE_TILES.map((tile) => (
              <TileButton
                key={tile.siteId}
                tile={tile}
                state={state}
                onRun={() => handleRun(tile)}
              />
            ))}
          </ul>
        </section>

        {/* ── Result (8 cols on lg) ───────────────────────────────────────── */}
        <section className="lg:col-span-8">
          <ResultPanel state={state} />
        </section>
      </div>
    </div>
  );
}

// ── Capability banner ────────────────────────────────────────────────────────

function CapabilityBanner({ caps }: { caps: RuntimeCapabilities | null }) {
  if (!caps) {
    return (
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
        Detecting runtime capabilities…
      </p>
    );
  }
  const backend = caps.modelAvailable
    ? caps.webgpu
      ? "WebGPU"
      : "WASM"
    : "Pre-computed (model awaiting export)";
  const detail = caps.modelAvailable
    ? `Inference will run client-side on ${backend}. No data leaves your device.`
    : `The ONNX export is still in progress. Predictions shown are the fine-tuned model's reference outputs on these tiles — same schema, same accuracy, no live computation.`;

  return (
    <div className="border-l-0 border-t border-[color:var(--color-rule)] pt-6">
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ocean)]">
        Runtime · {backend}
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
        {detail}
      </p>
    </div>
  );
}

// ── Tile button ──────────────────────────────────────────────────────────────

function TileButton({
  tile,
  state,
  onRun,
}: {
  tile: SampleTile;
  state: RunState;
  onRun: () => void;
}) {
  const isActive =
    (state.kind === "running" || state.kind === "done") &&
    state.siteId === tile.siteId;
  const isRunning = state.kind === "running" && state.siteId === tile.siteId;

  return (
    <li>
      <button
        type="button"
        onClick={onRun}
        disabled={isRunning}
        className={`group flex w-full items-center gap-4 border p-3 text-left transition-all duration-300 ${
          isActive
            ? "border-[color:var(--color-ink)] bg-[color:var(--color-surface)]"
            : "border-[color:var(--color-rule)] hover:border-[color:var(--color-ink-faint)]"
        }`}
        style={{ transitionTimingFunction: "var(--ease-out-quint)" }}
      >
        {/* Thumbnail */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden bg-[color:var(--color-surface-alt)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tile.tileUrl}
            alt={tile.label}
            className="h-full w-full object-cover"
          />
        </div>
        {/* Label */}
        <div className="min-w-0 flex-1">
          <p className="truncate font-[family-name:var(--font-display)] text-base font-medium leading-tight tracking-tight text-[color:var(--color-ink)]">
            {tile.label}
          </p>
          <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-[color:var(--color-ink-faint)]">
            {tile.category === "shrinkage"
              ? "Chronic shrinkage"
              : tile.category === "flooding"
                ? "Flooding regime"
                : "Mixed use"}
          </p>
        </div>
        {/* Action */}
        <span
          className={`shrink-0 text-xs font-medium uppercase tracking-[0.18em] ${
            isRunning
              ? "text-[color:var(--color-ochre-deep)]"
              : "text-[color:var(--color-ink-muted)] group-hover:text-[color:var(--color-ink)]"
          }`}
        >
          {isRunning ? "Running…" : "Run →"}
        </span>
      </button>
    </li>
  );
}

// ── Result panel ─────────────────────────────────────────────────────────────

function ResultPanel({ state }: { state: RunState }) {
  if (state.kind === "idle") {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center border border-[color:var(--color-rule)] p-12">
        <p className="max-w-sm text-center text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
          Pick a tile on the left. The fine-tuned model produces an
          eleven-field structured assessment — water extent, flood risk, crop
          stress, settlement, more.
        </p>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="border border-[color:var(--color-ochre-deep)] bg-[color:var(--color-surface)] p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ochre-deep)]">
          Inference error
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-ink)]">
          {state.message}
        </p>
      </div>
    );
  }
  if (state.kind === "running") {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-6 border border-[color:var(--color-rule)] p-12">
        <div className="h-1 w-32 overflow-hidden bg-[color:var(--color-surface-alt)]">
          <div
            className="h-full w-full bg-[color:var(--color-ocean)]"
            style={{
              animation: "av-progress 1.2s var(--ease-out-quint) infinite",
            }}
          />
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
          Classifying — eleven structured fields…
        </p>
        <style>
          {`@keyframes av-progress {
              0%   { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }`}
        </style>
      </div>
    );
  }
  return <DonePanel result={state.result} siteId={state.siteId} />;
}

function DonePanel({
  result,
  siteId,
}: {
  result: InferenceResult;
  siteId: string;
}) {
  const tile = SAMPLE_TILES.find((t) => t.siteId === siteId);

  return (
    <div className="border border-[color:var(--color-rule)] bg-[color:var(--color-surface)]">
      {/* Header */}
      <div className="flex items-baseline justify-between border-b border-[color:var(--color-rule)] px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ocean)]">
            Result · {result.backend}
          </p>
          <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl leading-tight tracking-tight text-[color:var(--color-ink)]">
            {tile?.label ?? siteId}
          </h3>
        </div>
        <p className="text-xs font-[family-name:var(--font-mono)] text-[color:var(--color-ink-faint)]">
          {result.latency_ms} ms
        </p>
      </div>

      {/* Field tables */}
      <div className="grid grid-cols-1 gap-x-12 px-6 py-6 md:grid-cols-2">
        <FieldGroup
          title="Core zone — water body"
          fields={CORE_FIELDS}
          prediction={result.prediction}
        />
        <FieldGroup
          title="Buffer zone — surrounding land"
          fields={BUFFER_FIELDS}
          prediction={result.prediction}
        />
      </div>
    </div>
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
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
        {title}
      </p>
      <dl className="mt-3 divide-y divide-[color:var(--color-rule)]">
        {fields.map((field) => (
          <div
            key={field}
            className="grid grid-cols-2 gap-x-4 py-3 text-sm"
          >
            <dt className="text-[color:var(--color-ink-muted)]">
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
        className={`font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.14em] ${
          value
            ? "text-[color:var(--color-ochre-deep)]"
            : "text-[color:var(--color-ink-faint)]"
        }`}
      >
        {value ? "yes" : "no"}
      </span>
    );
  }
  // Categorical — accent on values that signal stress; muted otherwise.
  const ACCENT_VALUES = new Set([
    "shrinking",
    "dry",
    "flooded",
    "active",
    "severe",
    "moderate",
    "heavily_silted",
    "drought",
    "flood_damage",
  ]);
  const isAccent = ACCENT_VALUES.has(value);
  return (
    <span
      className={`font-[family-name:var(--font-mono)] text-xs ${
        isAccent
          ? "text-[color:var(--color-ochre-deep)]"
          : "text-[color:var(--color-ink)]"
      }`}
    >
      {value.toString().replace(/_/g, " ")}
    </span>
  );
}
