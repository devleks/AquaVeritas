"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BUFFER_FIELDS,
  CORE_FIELDS,
  FIELD_LABELS,
  MODEL_ID,
  SAMPLE_TILES,
  type InferenceResult,
  type LoadProgress,
  type Prediction,
  type RuntimeCapabilities,
  type SampleTile,
  detectCapabilities,
  runInference,
} from "@/lib/inference";

type RunState =
  | { kind: "idle" }
  | { kind: "loading"; siteId: string; progress: LoadProgress }
  | { kind: "running"; siteId: string }
  | { kind: "done"; siteId: string; result: InferenceResult }
  | { kind: "error"; message: string };

type Mode = "stub" | "real";

export default function InferenceRunner() {
  const [caps, setCaps] = useState<RuntimeCapabilities | null>(null);
  const [mode, setMode] = useState<Mode>("stub");
  const [state, setState] = useState<RunState>({ kind: "idle" });
  const searchParams = useSearchParams();
  const autoRunFired = useRef(false);

  useEffect(() => {
    detectCapabilities().then(setCaps);
  }, []);

  /**
   * Auto-select + auto-run when the URL has ?site=lake_chad (e.g. arriving
   * from /globe). We auto-run only once per mount to avoid loops if the user
   * later toggles modes. Uses Reference mode for the auto-run so first-time
   * visitors don't trigger a 200 MB download without consent.
   */
  useEffect(() => {
    if (!caps || autoRunFired.current) return;
    const siteId = searchParams?.get("site");
    if (!siteId) return;
    const tile = SAMPLE_TILES.find((t) => t.siteId === siteId);
    if (!tile) return;
    autoRunFired.current = true;
    void (async () => {
      setState({ kind: "running", siteId });
      try {
        const result = await runInference(
          { siteId },
          { caps, mode: "stub" }, // never trigger a download from a URL param
        );
        setState({ kind: "done", siteId, result });
      } catch (err) {
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }, [caps, searchParams]);

  async function handleRun(tile: SampleTile) {
    if (!caps) return;
    setState({ kind: "running", siteId: tile.siteId });
    try {
      const result = await runInference(
        { siteId: tile.siteId },
        {
          caps,
          mode,
          onProgress: (p) => {
            if (p.status === "ready") {
              setState({ kind: "running", siteId: tile.siteId });
            } else {
              setState({ kind: "loading", siteId: tile.siteId, progress: p });
            }
          },
        },
      );
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
      <CapabilityBanner caps={caps} mode={mode} onModeChange={setMode} />

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-12">
        <section className="lg:col-span-4">
          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-ocean)]">
            Sample tiles
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl leading-tight tracking-tight text-[color:var(--color-ink)]">
            Pick a freshwater body
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
            Each tile is a Sentinel-2 RGB capture at 10 m resolution. Dates
            chosen for each site&rsquo;s most informative pass.
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

        <section className="lg:col-span-8">
          <ResultPanel state={state} mode={mode} />
        </section>
      </div>
    </div>
  );
}

// ── Capability banner with mode toggle ───────────────────────────────────────

function CapabilityBanner({
  caps,
  mode,
  onModeChange,
}: {
  caps: RuntimeCapabilities | null;
  mode: Mode;
  onModeChange: (m: Mode) => void;
}) {
  if (!caps) {
    return (
      <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
        Detecting runtime capabilities…
      </p>
    );
  }

  const realLabel = caps.webgpu
    ? "WebGPU available"
    : caps.wasm
      ? "WASM fallback"
      : "Unsupported";

  return (
    <div className="grid grid-cols-1 gap-8 border-t border-[color:var(--color-rule)] pt-6 md:grid-cols-12">
      {/* Left: status */}
      <div className="md:col-span-7">
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ocean)]">
          Runtime · {mode === "real" ? realLabel : "Pre-computed reference"}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-ink-muted)]">
          {mode === "real" ? (
            <>
              Inference runs client-side via{" "}
              <code className="font-[family-name:var(--font-mono)] text-xs text-[color:var(--color-ink)]">
                {MODEL_ID}
              </code>
              . First run downloads ~200 MB of model weights; cached for
              subsequent runs. The base model has not been fine-tuned for our
              schema — its raw text output is shown alongside parsed fields.
            </>
          ) : (
            <>
              Predictions shown are the fine-tuned model&rsquo;s reference
              outputs on these tiles. Same schema, same accuracy, no model
              download. Toggle to <em>real</em> for live browser inference
              against the base LFM2.5-VL.
            </>
          )}
        </p>
      </div>

      {/* Right: mode toggle */}
      <div className="flex items-start justify-start gap-1 md:col-span-5 md:justify-end">
        <ModePill
          active={mode === "stub"}
          onClick={() => onModeChange("stub")}
          label="Reference"
          sublabel="No download"
        />
        <ModePill
          active={mode === "real"}
          onClick={() => onModeChange("real")}
          label="Real model"
          sublabel={`Base LFM2.5-VL · ${caps.webgpu ? "WebGPU" : "WASM"}`}
          disabled={!caps.wasm}
        />
      </div>
    </div>
  );
}

function ModePill({
  active,
  onClick,
  label,
  sublabel,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sublabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-start border px-4 py-2 text-left transition-all duration-300 disabled:opacity-40 ${
        active
          ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-surface)]"
          : "border-[color:var(--color-rule)] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink-faint)]"
      }`}
      style={{ transitionTimingFunction: "var(--ease-out-quint)" }}
    >
      <span className="text-xs font-medium uppercase tracking-[0.16em]">
        {label}
      </span>
      <span
        className={`mt-0.5 text-[10px] uppercase tracking-[0.12em] ${active ? "text-[color:var(--color-ink-faint)]" : "text-[color:var(--color-ink-muted)]"}`}
      >
        {sublabel}
      </span>
    </button>
  );
}

// ── Tile button (unchanged from Day 2) ───────────────────────────────────────

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
    (state.kind === "running" ||
      state.kind === "loading" ||
      state.kind === "done") &&
    state.siteId === tile.siteId;
  const isBusy =
    (state.kind === "running" || state.kind === "loading") &&
    state.siteId === tile.siteId;

  return (
    <li>
      <button
        type="button"
        onClick={onRun}
        disabled={isBusy}
        className={`group flex w-full items-center gap-4 border p-3 text-left transition-all duration-300 ${
          isActive
            ? "border-[color:var(--color-ink)] bg-[color:var(--color-surface)]"
            : "border-[color:var(--color-rule)] hover:border-[color:var(--color-ink-faint)]"
        }`}
        style={{ transitionTimingFunction: "var(--ease-out-quint)" }}
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden bg-[color:var(--color-surface-alt)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tile.tileUrl}
            alt={tile.label}
            className="h-full w-full object-cover"
          />
        </div>
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
        <span
          className={`shrink-0 text-xs font-medium uppercase tracking-[0.18em] ${
            isBusy
              ? "text-[color:var(--color-ochre-deep)]"
              : "text-[color:var(--color-ink-muted)] group-hover:text-[color:var(--color-ink)]"
          }`}
        >
          {isBusy ? "Running…" : "Run →"}
        </span>
      </button>
    </li>
  );
}

// ── Result panel ─────────────────────────────────────────────────────────────

function ResultPanel({ state, mode }: { state: RunState; mode: Mode }) {
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
        <p className="mt-2 break-words text-sm leading-relaxed text-[color:var(--color-ink)]">
          {state.message}
        </p>
      </div>
    );
  }
  if (state.kind === "loading") {
    return <LoadingPanel progress={state.progress} />;
  }
  if (state.kind === "running") {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-6 border border-[color:var(--color-rule)] p-12">
        <Indeterminate />
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)]">
          Classifying — eleven structured fields…
        </p>
      </div>
    );
  }
  return <DonePanel result={state.result} siteId={state.siteId} mode={mode} />;
}

function LoadingPanel({ progress }: { progress: LoadProgress }) {
  const pct =
    progress.progress !== undefined ? Math.round(progress.progress * 100) : null;
  const sizeStr =
    progress.loaded && progress.total
      ? `${(progress.loaded / 1e6).toFixed(0)} / ${(progress.total / 1e6).toFixed(0)} MB`
      : null;
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-6 border border-[color:var(--color-rule)] p-12">
      <div className="h-1 w-64 overflow-hidden bg-[color:var(--color-surface-alt)]">
        <div
          className="h-full bg-[color:var(--color-ocean)] transition-all duration-300"
          style={{
            width: pct !== null ? `${pct}%` : "20%",
            transitionTimingFunction: "var(--ease-out-quint)",
          }}
        />
      </div>
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ocean)]">
          {progress.status === "downloading"
            ? "Downloading model"
            : "Loading model"}
        </p>
        <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[color:var(--color-ink-muted)]">
          {progress.file ?? ""}
          {pct !== null && ` · ${pct}%`}
          {sizeStr && ` · ${sizeStr}`}
        </p>
      </div>
    </div>
  );
}

function Indeterminate() {
  return (
    <div className="h-1 w-32 overflow-hidden bg-[color:var(--color-surface-alt)]">
      <div
        className="h-full w-full bg-[color:var(--color-ocean)]"
        style={{
          animation: "av-progress 1.2s var(--ease-out-quint) infinite",
        }}
      />
      <style>
        {`@keyframes av-progress {
            0%   { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }`}
      </style>
    </div>
  );
}

function DonePanel({
  result,
  siteId,
  mode,
}: {
  result: InferenceResult;
  siteId: string;
  mode: Mode;
}) {
  const tile = SAMPLE_TILES.find((t) => t.siteId === siteId);

  return (
    <div className="border border-[color:var(--color-rule)] bg-[color:var(--color-surface)]">
      <div className="flex items-baseline justify-between border-b border-[color:var(--color-rule)] px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-ocean)]">
            Result · {result.backend}
            {mode === "real" && result.backend !== "stub" && " · base model"}
          </p>
          <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl leading-tight tracking-tight text-[color:var(--color-ink)]">
            {tile?.label ?? siteId}
          </h3>
        </div>
        <p className="text-xs font-[family-name:var(--font-mono)] text-[color:var(--color-ink-faint)]">
          {result.latency_ms} ms
        </p>
      </div>

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

      {/* Show the raw text when in real mode so the base-model output is honest */}
      {result.raw_text && (
        <details className="border-t border-[color:var(--color-rule)] px-6 py-4">
          <summary className="cursor-pointer text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-faint)] transition-colors hover:text-[color:var(--color-ink)]">
            Raw model output
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-[color:var(--color-ink-muted)]">
            {result.raw_text}
          </pre>
        </details>
      )}
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
          <div key={field} className="grid grid-cols-2 gap-x-4 py-3 text-sm">
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
